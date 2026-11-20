// Monthly totals in one display currency. Each entry is converted with the rate stored on it,
// so old months don't shift when today's rate moves.
import { convert, type Currency } from './money';
import type { AllocationStatus } from './split';

export type SummaryTxn = {
  type: 'income' | 'expense';
  amount: number;
  currency: Currency;
  fx_rate_to_ngn: number;
  category_id: number;
  category_name: string;
  category_colour: string;
  /** For income: total due to buckets. */
  allocated: number;
};

export type CategoryTotal = { id: number; name: string; colour: string; total: number };

export type MonthSummary = {
  income: number;
  spendableIncome: number;
  expenses: number;
  left: number;
  byCategory: CategoryTotal[];
};

export function summarise(rows: SummaryTxn[], to: Currency): MonthSummary {
  let income = 0;
  let spendableIncome = 0;
  let expenses = 0;
  const cats = new Map<number, CategoryTotal>();
  for (const r of rows) {
    const amt = convert(r.amount, r.currency, to, r.fx_rate_to_ngn);
    if (r.type === 'income') {
      income += amt;
      spendableIncome += convert(r.amount - r.allocated, r.currency, to, r.fx_rate_to_ngn);
    } else {
      expenses += amt;
      const c = cats.get(r.category_id) ?? { id: r.category_id, name: r.category_name, colour: r.category_colour, total: 0 };
      c.total += amt;
      cats.set(r.category_id, c);
    }
  }
  const byCategory = [...cats.values()].sort((a, b) => b.total - a.total);
  return { income, spendableIncome, expenses, left: spendableIncome - expenses, byCategory };
}

export type SummaryAllocation = {
  bucket_id: number;
  amount_due: number;
  amount_moved: number;
  currency: Currency;
  fx_rate_to_ngn: number;
  status: AllocationStatus;
};

export type BucketTotals = { due: number; moved: number; pending: number; openCount: number };

export function bucketTotals(allocs: SummaryAllocation[], to: Currency): Map<number, BucketTotals> {
  const out = new Map<number, BucketTotals>();
  for (const a of allocs) {
    const t = out.get(a.bucket_id) ?? { due: 0, moved: 0, pending: 0, openCount: 0 };
    const due = convert(a.amount_due, a.currency, to, a.fx_rate_to_ngn);
    const moved = convert(a.amount_moved, a.currency, to, a.fx_rate_to_ngn);
    t.due += due;
    t.moved += moved;
    t.pending += due - moved;
    if (a.status !== 'done' && a.amount_due > 0) t.openCount++;
    out.set(a.bucket_id, t);
  }
  return out;
}
