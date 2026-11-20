// Typed data access. Every write that touches more than one row runs in one exclusive
// transaction so an income and its allocations are always saved (or refused) together.
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Currency } from '../lib/money';
import { checkMoved, splitIncome, statusFor, validatePercentages, type AllocationStatus } from '../lib/split';

export type Kind = 'income' | 'expense';

export type Category = {
  id: number;
  name: string;
  icon: string;
  colour: string;
  kind: Kind;
  sort_order: number;
  usage_count: number;
  archived: number;
};

export type Txn = {
  id: number;
  type: Kind;
  amount: number;
  currency: Currency;
  category_id: number;
  date: string;
  note: string | null;
  fx_rate_to_ngn: number;
  created_at: string;
};

/** A transaction with its category and, for income, the total set aside for buckets. */
export type TxnRow = Txn & {
  category_name: string;
  category_icon: string;
  category_colour: string;
  allocated: number;
};

export type Bucket = { id: number; key: string; name: string; percentage: number; colour: string; sort_order: number };

export type Allocation = {
  id: number;
  income_transaction_id: number;
  bucket_id: number;
  percentage: number;
  amount_due: number;
  amount_moved: number;
  currency: Currency;
  status: AllocationStatus;
  updated_at: string;
};

export type AllocationRow = Allocation & {
  date: string;
  note: string | null;
  income_amount: number;
  fx_rate_to_ngn: number;
  category_name: string;
};

export type Settings = {
  default_currency: Currency;
  last_currency: Currency;
  theme: 'system' | 'light' | 'dark';
  last_fx_rate: number;
  fx_source: 'default' | 'live' | 'manual';
  fx_updated_at: string;
  last_review_week: string;
};

export class UserError extends Error {}

const now = () => new Date().toISOString();

// --- Settings ---------------------------------------------------------------------------

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    default_currency: (m.default_currency as Currency) ?? 'NGN',
    last_currency: (m.last_currency as Currency) ?? 'NGN',
    theme: (m.theme as Settings['theme']) ?? 'system',
    last_fx_rate: Number(m.last_fx_rate) || 1_500_000,
    fx_source: (m.fx_source as Settings['fx_source']) ?? 'default',
    fx_updated_at: m.fx_updated_at ?? '',
    last_review_week: m.last_review_week ?? '',
  };
}

export async function setSettings(db: SQLiteDatabase, values: Partial<Record<keyof Settings, string | number>>) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [k, v] of Object.entries(values)) {
      await tx.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        k, String(v),
      );
    }
  });
}

// --- Categories -------------------------------------------------------------------------

/** Most-used first, so quick entry shows the likely category without scrolling. */
export function listCategories(db: SQLiteDatabase, kind: Kind, includeArchived = false) {
  return db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE kind = ? ${includeArchived ? '' : 'AND archived = 0'}
     ORDER BY usage_count DESC, sort_order, id`,
    kind,
  );
}

export async function saveCategory(
  db: SQLiteDatabase,
  c: { id?: number; name: string; icon: string; colour: string; kind: Kind },
) {
  const name = c.name.trim();
  if (!name) throw new UserError('Give the category a name.');
  if (name.length > 24) throw new UserError('Keep the name to 24 characters or fewer.');
  if (c.id) {
    await db.runAsync('UPDATE categories SET name = ?, icon = ?, colour = ? WHERE id = ?', name, c.icon, c.colour, c.id);
  } else {
    const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories WHERE kind = ?', c.kind);
    await db.runAsync(
      'INSERT INTO categories (name, icon, colour, kind, sort_order) VALUES (?, ?, ?, ?, ?)',
      name, c.icon, c.colour, c.kind, (max?.m ?? 0) + 1,
    );
  }
}

/** Categories with history are hidden, not deleted, so past entries keep their label. */
export async function setCategoryArchived(db: SQLiteDatabase, id: number, archived: boolean) {
  await db.runAsync('UPDATE categories SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

// --- Buckets ----------------------------------------------------------------------------

export function listBuckets(db: SQLiteDatabase) {
  return db.getAllAsync<Bucket>('SELECT * FROM buckets ORDER BY sort_order, id');
}

/** Affects future income only: allocations keep the percentage they were created with. */
export async function setBucketPercentages(db: SQLiteDatabase, percentages: Record<number, number>) {
  const err = validatePercentages(Object.values(percentages));
  if (err) throw new UserError(err);
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [id, pct] of Object.entries(percentages)) {
      await tx.runAsync('UPDATE buckets SET percentage = ? WHERE id = ?', pct, Number(id));
    }
  });
}

// --- Transactions -----------------------------------------------------------------------

export type TxnInput = {
  type: Kind;
  amount: number;
  currency: Currency;
  categoryId: number;
  date: string;
  note: string | null;
  fxRateToNgn: number;
};

function checkInput(t: TxnInput) {
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0) throw new UserError('Enter an amount above zero.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) throw new UserError('That date is not valid.');
  if (!Number.isSafeInteger(t.fxRateToNgn) || t.fxRateToNgn <= 0) throw new UserError('Set an exchange rate in Settings first.');
}

/** Create, or update when `id` is given. Income gets one allocation per bucket. */
export async function saveTransaction(db: SQLiteDatabase, t: TxnInput, id?: number): Promise<number> {
  checkInput(t);
  let savedId = id ?? 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const cat = await tx.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', t.categoryId);
    if (!cat || cat.kind !== t.type) throw new UserError('Pick a category.');

    if (!id) {
      const r = await tx.runAsync(
        `INSERT INTO transactions (type, amount, currency, category_id, date, note, fx_rate_to_ngn, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        t.type, t.amount, t.currency, t.categoryId, t.date, t.note, t.fxRateToNgn, now(),
      );
      savedId = r.lastInsertRowId;
      await tx.runAsync('UPDATE categories SET usage_count = usage_count + 1 WHERE id = ?', t.categoryId);
      if (t.type === 'income') {
        const buckets = await tx.getAllAsync<Bucket>('SELECT * FROM buckets ORDER BY sort_order, id');
        await insertAllocations(tx, savedId, t, buckets.map((b) => ({ bucketId: b.id, percentage: b.percentage })));
      }
    } else {
      const old = await tx.getFirstAsync<Txn>('SELECT * FROM transactions WHERE id = ?', id);
      if (!old) throw new UserError('That entry no longer exists.');
      const allocs = await tx.getAllAsync<Allocation>('SELECT * FROM allocations WHERE income_transaction_id = ?', id);
      const moved = allocs.some((a) => a.amount_moved > 0);
      if (moved && (old.type !== t.type || old.currency !== t.currency)) {
        throw new UserError('Money from this income was already set aside. Undo those moves in Buckets before changing its type or currency.');
      }

      await tx.runAsync(
        `UPDATE transactions SET type = ?, amount = ?, currency = ?, category_id = ?, date = ?, note = ?, fx_rate_to_ngn = ?
         WHERE id = ?`,
        t.type, t.amount, t.currency, t.categoryId, t.date, t.note, t.fxRateToNgn, id,
      );
      if (old.category_id !== t.categoryId) {
        await tx.runAsync('UPDATE categories SET usage_count = MAX(usage_count - 1, 0) WHERE id = ?', old.category_id);
        await tx.runAsync('UPDATE categories SET usage_count = usage_count + 1 WHERE id = ?', t.categoryId);
      }

      if (t.type === 'expense') {
        await tx.runAsync('DELETE FROM allocations WHERE income_transaction_id = ?', id);
      } else if (old.type === 'expense') {
        const buckets = await tx.getAllAsync<Bucket>('SELECT * FROM buckets ORDER BY sort_order, id');
        await insertAllocations(tx, id, t, buckets.map((b) => ({ bucketId: b.id, percentage: b.percentage })));
      } else {
        // Same income, new amount: keep each allocation's original percentage.
        const { lines } = splitIncome(t.amount, allocs.map((a) => ({ bucketId: a.bucket_id, percentage: a.percentage })));
        for (const [i, a] of allocs.entries()) {
          const due = lines[i].amountDue;
          if (a.amount_moved > due) {
            throw new UserError('More than the new amount was already set aside. Reduce the moved amounts in Buckets first.');
          }
          await tx.runAsync(
            'UPDATE allocations SET amount_due = ?, currency = ?, status = ?, updated_at = ? WHERE id = ?',
            due, t.currency, statusFor(due, a.amount_moved), now(), a.id,
          );
        }
      }
    }
    await tx.runAsync(
      "INSERT INTO settings (key, value) VALUES ('last_currency', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      t.currency,
    );
  });
  return savedId;
}

async function insertAllocations(
  tx: Pick<SQLiteDatabase, 'runAsync'>,
  incomeId: number,
  t: TxnInput,
  shares: { bucketId: number; percentage: number }[],
) {
  const { lines } = splitIncome(t.amount, shares);
  for (const l of lines) {
    await tx.runAsync(
      `INSERT INTO allocations (income_transaction_id, bucket_id, percentage, amount_due, amount_moved, currency, status, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      incomeId, l.bucketId, l.percentage, l.amountDue, t.currency, statusFor(l.amountDue, 0), now(),
    );
  }
}

export async function deleteTransaction(db: SQLiteDatabase, id: number) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const old = await tx.getFirstAsync<Txn>('SELECT * FROM transactions WHERE id = ?', id);
    if (!old) return;
    await tx.runAsync('DELETE FROM allocations WHERE income_transaction_id = ?', id);
    await tx.runAsync('DELETE FROM transactions WHERE id = ?', id);
    await tx.runAsync('UPDATE categories SET usage_count = MAX(usage_count - 1, 0) WHERE id = ?', old.category_id);
  });
}

export function getTransaction(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Txn>('SELECT * FROM transactions WHERE id = ?', id);
}

export type TxnFilter = {
  month?: string;
  from?: string; // inclusive day
  to?: string; // inclusive day
  categoryId?: number;
  type?: Kind;
  currency?: Currency;
  limit?: number;
};

export function listTransactions(db: SQLiteDatabase, f: TxnFilter = {}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.month) { where.push('t.date LIKE ?'); params.push(`${f.month}-%`); }
  if (f.from) { where.push('t.date >= ?'); params.push(f.from); }
  if (f.to) { where.push('t.date <= ?'); params.push(f.to); }
  if (f.categoryId) { where.push('t.category_id = ?'); params.push(f.categoryId); }
  if (f.type) { where.push('t.type = ?'); params.push(f.type); }
  if (f.currency) { where.push('t.currency = ?'); params.push(f.currency); }
  return db.getAllAsync<TxnRow>(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.colour AS category_colour,
            COALESCE((SELECT SUM(a.amount_due) FROM allocations a WHERE a.income_transaction_id = t.id), 0) AS allocated
     FROM transactions t JOIN categories c ON c.id = t.category_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY t.date DESC, t.id DESC
     ${f.limit ? 'LIMIT ' + Math.floor(f.limit) : ''}`,
    params,
  );
}

/** Distinct days with at least one entry, newest first (for the streak). */
export async function loggedDays(db: SQLiteDatabase, since: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>(
    'SELECT DISTINCT date AS day FROM transactions WHERE date >= ? ORDER BY date DESC',
    since,
  );
  return rows.map((r) => r.day);
}

// --- Allocations ------------------------------------------------------------------------

export function listAllocations(db: SQLiteDatabase, bucketId: number) {
  return db.getAllAsync<AllocationRow>(
    `SELECT a.*, t.date, t.note, t.amount AS income_amount, t.fx_rate_to_ngn, c.name AS category_name
     FROM allocations a
     JOIN transactions t ON t.id = a.income_transaction_id
     JOIN categories c ON c.id = t.category_id
     WHERE a.bucket_id = ?
     ORDER BY (a.status = 'done'), t.date DESC, a.id DESC`,
    bucketId,
  );
}

/** Every allocation with its income's rate, for totals in one display currency. */
export function allAllocations(db: SQLiteDatabase) {
  return db.getAllAsync<Allocation & { fx_rate_to_ngn: number }>(
    `SELECT a.*, t.fx_rate_to_ngn FROM allocations a JOIN transactions t ON t.id = a.income_transaction_id`,
  );
}

export async function setAmountMoved(db: SQLiteDatabase, allocationId: number, amountMoved: number) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const a = await tx.getFirstAsync<Allocation>('SELECT * FROM allocations WHERE id = ?', allocationId);
    if (!a) throw new UserError('That allocation no longer exists.');
    const err = checkMoved(a.amount_due, amountMoved);
    if (err) throw new UserError(err);
    await tx.runAsync(
      'UPDATE allocations SET amount_moved = ?, status = ?, updated_at = ? WHERE id = ?',
      amountMoved, statusFor(a.amount_due, amountMoved), now(), allocationId,
    );
  });
}

// --- Budgets ----------------------------------------------------------------------------

export type BudgetRow = { category_id: number; month: string; limit_amount: number; currency: Currency };

/**
 * The limit in force for each expense category in `month`: the latest one set in or before
 * that month, so a budget carries forward until changed. A limit of 0 means "no budget".
 */
export async function budgetsFor(db: SQLiteDatabase, month: string): Promise<Map<number, BudgetRow>> {
  const rows = await db.getAllAsync<BudgetRow>(
    `SELECT b.category_id, b.month, b.limit_amount, b.currency FROM budgets b
     WHERE b.month = (SELECT MAX(b2.month) FROM budgets b2 WHERE b2.category_id = b.category_id AND b2.month <= ?)`,
    month,
  );
  return new Map(rows.filter((r) => r.limit_amount > 0).map((r) => [r.category_id, r]));
}

export async function setBudget(db: SQLiteDatabase, categoryId: number, month: string, limit: number, currency: Currency) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new UserError('Enter a limit of zero or more.');
  await db.runAsync(
    `INSERT INTO budgets (category_id, month, limit_amount, currency) VALUES (?, ?, ?, ?)
     ON CONFLICT(category_id, month) DO UPDATE SET limit_amount = excluded.limit_amount, currency = excluded.currency`,
    categoryId, month, limit, currency,
  );
}
