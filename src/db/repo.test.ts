// Runs the real schema and repository against SQLite (node:sqlite) through a small adapter
// that mimics the expo-sqlite async API the app uses.
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';

vi.mock('expo-sqlite', () => ({}));

import { migrate } from './schema';
import {
  budgetsFor,
  deleteTransaction,
  listAllocations,
  listBuckets,
  listCategories,
  listTransactions,
  saveTransaction,
  setAmountMoved,
  setBucketPercentages,
  setBudget,
  UserError,
} from './repo';

function adapter(raw: DatabaseSync): SQLiteDatabase {
  const args = (params: unknown[]) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as never[];
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...p: unknown[]) => {
      const r = raw.prepare(sql).run(...args(p));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getAllAsync: async (sql: string, ...p: unknown[]) => raw.prepare(sql).all(...args(p)),
    getFirstAsync: async (sql: string, ...p: unknown[]) => raw.prepare(sql).get(...args(p)) ?? null,
    withExclusiveTransactionAsync: async (task: (tx: unknown) => Promise<void>) => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        await task(db);
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db as unknown as SQLiteDatabase;
}

let db: SQLiteDatabase;
const RATE = 1_500_000;

beforeEach(async () => {
  db = adapter(new DatabaseSync(':memory:'));
  await migrate(db);
});

async function cat(kind: 'income' | 'expense', name: string) {
  const c = (await listCategories(db, kind)).find((x) => x.name === name);
  if (!c) throw new Error(name);
  return c.id;
}

describe('repository', () => {
  it('seeds categories and the default 25/10/10 buckets, and migrating twice is harmless', async () => {
    await migrate(db);
    expect((await listCategories(db, 'expense')).map((c) => c.name)).toEqual(
      ['Food', 'Transport', 'Data/airtime', 'Motsa', 'Utilities', 'Personal', 'Giving', 'Other'],
    );
    expect((await listBuckets(db)).map((b) => [b.key, b.percentage])).toEqual([['savings', 25], ['tithe', 10], ['investment', 10]]);
  });

  it('splits income into pending allocations', async () => {
    const id = await saveTransaction(db, {
      type: 'income', amount: 200000_00, currency: 'NGN', categoryId: await cat('income', 'Salary/clients'),
      date: '2026-11-20', note: null, fxRateToNgn: RATE,
    });
    const buckets = await listBuckets(db);
    const savings = await listAllocations(db, buckets[0].id);
    expect(savings).toHaveLength(1);
    expect(savings[0]).toMatchObject({ income_transaction_id: id, amount_due: 50000_00, amount_moved: 0, status: 'pending', percentage: 25 });
    const [row] = await listTransactions(db, { month: '2026-11' });
    expect(row.allocated).toBe(90000_00);
  });

  it('changing percentages only affects future income', async () => {
    const salary = await cat('income', 'Salary/clients');
    const base = { type: 'income' as const, currency: 'NGN' as const, categoryId: salary, date: '2026-11-20', note: null, fxRateToNgn: RATE };
    await saveTransaction(db, { ...base, amount: 1000_00 });
    const buckets = await listBuckets(db);
    await setBucketPercentages(db, { [buckets[0].id]: 30, [buckets[1].id]: 10, [buckets[2].id]: 10 });
    await saveTransaction(db, { ...base, amount: 1000_00 });
    const dues = (await listAllocations(db, buckets[0].id)).map((a) => a.amount_due).sort();
    expect(dues).toEqual([250_00, 300_00]);
    await expect(setBucketPercentages(db, { [buckets[0].id]: 90, [buckets[1].id]: 10, [buckets[2].id]: 10 })).rejects.toBeInstanceOf(UserError);
  });

  it('marks allocations partly and fully done, and refuses over-moving', async () => {
    await saveTransaction(db, {
      type: 'income', amount: 1000_00, currency: 'USD', categoryId: await cat('income', 'Business'),
      date: '2026-11-20', note: null, fxRateToNgn: RATE,
    });
    const tithe = (await listBuckets(db))[1];
    const [a] = await listAllocations(db, tithe.id);
    expect(a.amount_due).toBe(100_00);
    await setAmountMoved(db, a.id, 40_00);
    expect((await listAllocations(db, tithe.id))[0].status).toBe('partial');
    await setAmountMoved(db, a.id, 100_00);
    expect((await listAllocations(db, tithe.id))[0].status).toBe('done');
    await expect(setAmountMoved(db, a.id, 100_01)).rejects.toBeInstanceOf(UserError);
  });

  it('editing an income keeps each allocation\'s original percentage and refuses unsafe edits', async () => {
    const salary = await cat('income', 'Salary/clients');
    const base = { type: 'income' as const, currency: 'NGN' as const, categoryId: salary, date: '2026-11-20', note: null, fxRateToNgn: RATE };
    const id = await saveTransaction(db, { ...base, amount: 1000_00 });
    const buckets = await listBuckets(db);
    await setBucketPercentages(db, { [buckets[0].id]: 50, [buckets[1].id]: 10, [buckets[2].id]: 10 });
    await saveTransaction(db, { ...base, amount: 2000_00 }, id);
    const [s] = await listAllocations(db, buckets[0].id);
    expect(s).toMatchObject({ percentage: 25, amount_due: 500_00 });

    await setAmountMoved(db, s.id, 500_00);
    await expect(saveTransaction(db, { ...base, amount: 1000_00 }, id)).rejects.toThrow(/already set aside/);
    await expect(saveTransaction(db, { ...base, amount: 2000_00, currency: 'USD' }, id)).rejects.toBeInstanceOf(UserError);
    // The refused edits changed nothing.
    expect((await listTransactions(db))[0].amount).toBe(2000_00);
  });

  it('turning an income into an expense removes its allocations; deleting cascades', async () => {
    const id = await saveTransaction(db, {
      type: 'income', amount: 500_00, currency: 'NGN', categoryId: await cat('income', 'Gifts'),
      date: '2026-11-20', note: 'aunty', fxRateToNgn: RATE,
    });
    await saveTransaction(db, {
      type: 'expense', amount: 500_00, currency: 'NGN', categoryId: await cat('expense', 'Food'),
      date: '2026-11-20', note: null, fxRateToNgn: RATE,
    }, id);
    const buckets = await listBuckets(db);
    expect(await listAllocations(db, buckets[0].id)).toHaveLength(0);

    const inc = await saveTransaction(db, {
      type: 'income', amount: 500_00, currency: 'NGN', categoryId: await cat('income', 'Gifts'),
      date: '2026-11-20', note: null, fxRateToNgn: RATE,
    });
    await deleteTransaction(db, inc);
    expect(await listAllocations(db, buckets[0].id)).toHaveLength(0);
    expect(await listTransactions(db)).toHaveLength(1);
  });

  it('rejects a category of the wrong kind and a zero amount', async () => {
    const base = { type: 'expense' as const, amount: 100, currency: 'NGN' as const, date: '2026-11-20', note: null, fxRateToNgn: RATE };
    await expect(saveTransaction(db, { ...base, categoryId: await cat('income', 'Gifts') })).rejects.toBeInstanceOf(UserError);
    await expect(saveTransaction(db, { ...base, amount: 0, categoryId: await cat('expense', 'Food') })).rejects.toBeInstanceOf(UserError);
  });

  it('sorts quick-entry categories by use', async () => {
    const transport = await cat('expense', 'Transport');
    for (let i = 0; i < 2; i++) {
      await saveTransaction(db, { type: 'expense', amount: 100, currency: 'NGN', categoryId: transport, date: '2026-11-20', note: null, fxRateToNgn: RATE });
    }
    expect((await listCategories(db, 'expense'))[0].name).toBe('Transport');
  });

  it('carries budgets forward until changed, and 0 removes one', async () => {
    const food = await cat('expense', 'Food');
    await setBudget(db, food, '2026-09', 50000_00, 'NGN');
    expect((await budgetsFor(db, '2026-11')).get(food)?.limit_amount).toBe(50000_00);
    expect((await budgetsFor(db, '2026-08')).get(food)).toBeUndefined();
    await setBudget(db, food, '2026-11', 0, 'NGN');
    expect((await budgetsFor(db, '2026-11')).get(food)).toBeUndefined();
    expect((await budgetsFor(db, '2026-10')).get(food)?.limit_amount).toBe(50000_00);
  });
});
