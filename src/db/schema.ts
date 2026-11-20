import type { SQLiteDatabase } from 'expo-sqlite';

// Amounts are INTEGER minor units (kobo / cents). Rates are INTEGER naira-per-dollar x 1000.
// Bucket percentages are whole numbers. Dates are local "YYYY-MM-DD", months "YYYY-MM".

const MIGRATIONS: string[] = [
  `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    colour TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    date TEXT NOT NULL,
    note TEXT,
    fx_rate_to_ngn INTEGER NOT NULL CHECK (fx_rate_to_ngn > 0),
    created_at TEXT NOT NULL
  );
  CREATE INDEX transactions_date ON transactions(date);

  CREATE TABLE buckets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    percentage INTEGER NOT NULL CHECK (percentage BETWEEN 0 AND 100),
    colour TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    income_transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    bucket_id INTEGER NOT NULL REFERENCES buckets(id),
    percentage INTEGER NOT NULL,
    amount_due INTEGER NOT NULL CHECK (amount_due >= 0),
    amount_moved INTEGER NOT NULL DEFAULT 0 CHECK (amount_moved >= 0),
    currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'done')),
    updated_at TEXT NOT NULL,
    CHECK (amount_moved <= amount_due)
  );
  CREATE INDEX allocations_income ON allocations(income_transaction_id);

  CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    limit_amount INTEGER NOT NULL CHECK (limit_amount >= 0),
    currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
    UNIQUE (category_id, month)
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

type SeedCategory = [name: string, icon: string, colour: string];

const EXPENSE: SeedCategory[] = [
  ['Food', 'food-outline', '#f59e0b'],
  ['Transport', 'bus', '#0089ff'],
  ['Data/airtime', 'cellphone-wireless', '#7c4dff'],
  ['Motsa', 'motorbike', '#14b8a6'],
  ['Utilities', 'lightning-bolt-outline', '#eab308'],
  ['Personal', 'account-outline', '#ec4899'],
  ['Giving', 'hand-heart-outline', '#0e9f6e'],
  ['Other', 'dots-horizontal', '#64748b'],
];

const INCOME: SeedCategory[] = [
  ['Salary/clients', 'briefcase-outline', '#0e9f6e'],
  ['Business', 'storefront-outline', '#0935d1'],
  ['Gifts', 'gift-outline', '#ec4899'],
  ['Other', 'dots-horizontal', '#64748b'],
];

// Bucket accents come from Stow's palette.
const BUCKETS: [key: string, name: string, pct: number, colour: string][] = [
  ['savings', 'Savings', 25, '#0935d1'],
  ['tithe', 'Tithe', 10, '#7c4dff'],
  ['investment', 'Investment', 10, '#0089ff'],
];

/** Default NGN per USD until a live rate is fetched or entered. */
export const FALLBACK_RATE_MILLI = 1_500_000;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(sql);
      if (next === 1) await seed(tx);
      await tx.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

async function seed(db: Pick<SQLiteDatabase, 'runAsync'>) {
  const add = async (kind: 'income' | 'expense', list: SeedCategory[]) => {
    for (const [i, [name, icon, colour]] of list.entries()) {
      await db.runAsync(
        'INSERT INTO categories (name, icon, colour, kind, sort_order) VALUES (?, ?, ?, ?, ?)',
        name, icon, colour, kind, i,
      );
    }
  };
  await add('expense', EXPENSE);
  await add('income', INCOME);
  for (const [i, [key, name, pct, colour]] of BUCKETS.entries()) {
    await db.runAsync(
      'INSERT INTO buckets (key, name, percentage, colour, sort_order) VALUES (?, ?, ?, ?, ?)',
      key, name, pct, colour, i,
    );
  }
  const defaults: Record<string, string> = {
    default_currency: 'NGN',
    last_currency: 'NGN',
    theme: 'system',
    last_fx_rate: String(FALLBACK_RATE_MILLI),
    fx_source: 'default',
    fx_updated_at: '',
    last_review_week: '',
  };
  for (const [k, v] of Object.entries(defaults)) {
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', k, v);
  }
}
