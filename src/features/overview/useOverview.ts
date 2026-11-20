import type { SQLiteDatabase } from 'expo-sqlite';
import { allAllocations, budgetsFor, listBuckets, listCategories, listTransactions, loggedDays } from '../../db/repo';
import { addDays, addMonths, monthOf, parseDay, today, weekStart } from '../../lib/dates';
import { buildInsights } from '../../lib/insights';
import { convert, type Currency } from '../../lib/money';
import { loggingStreak } from '../../lib/streak';
import { bucketTotals, summarise } from '../../lib/summary';

/** Everything the Overview screen shows, computed in one pass in the display currency. */
export async function loadOverview(db: SQLiteDatabase, currency: Currency, rateNow: number) {
  const day = today();
  const month = monthOf(day);
  const prevMonth = addMonths(month, -1);
  const dayOfMonth = parseDay(day).getDate();

  const [rows, prevRows, buckets, allocs, budgets, expenseCats, days, recent] = await Promise.all([
    listTransactions(db, { month }),
    listTransactions(db, { from: `${prevMonth}-01`, to: `${prevMonth}-${String(dayOfMonth).padStart(2, '0')}` }),
    listBuckets(db),
    allAllocations(db),
    budgetsFor(db, month),
    listCategories(db, 'expense', true),
    loggedDays(db, addDays(day, -400)),
    listTransactions(db, { limit: 5 }),
  ]);

  const summary = summarise(rows, currency);
  const prev = summarise(prevRows, currency);
  const totals = bucketTotals(allocs, currency);
  const streak = loggingStreak(days, day);

  const spentBy = new Map(summary.byCategory.map((c) => [c.id, c.total]));
  const prevBy = new Map(prev.byCategory.map((c) => [c.id, c.total]));
  const catName = new Map(expenseCats.map((c) => [c.id, c.name]));

  const budgetList = [...budgets.values()].map((b) => ({
    name: catName.get(b.category_id) ?? 'Category',
    // Budgets are kept in their own currency; compare in the display currency at today's rate.
    limit: convert(b.limit_amount, b.currency, currency, rateNow),
    spent: spentBy.get(b.category_id) ?? 0,
  }));

  const lastDay = new Date(parseDay(day).getFullYear(), parseDay(day).getMonth() + 1, 0).getDate();
  const insights = buildInsights({
    currency,
    categories: expenseCats.map((c) => ({
      name: c.name,
      thisMonth: spentBy.get(c.id) ?? 0,
      lastMonthSameDay: prevBy.get(c.id) ?? 0,
    })),
    budgets: budgetList,
    pendingBuckets: buckets.map((b) => ({ name: b.name, pending: totals.get(b.id)?.pending ?? 0 })),
    streak,
    spendableLeft: summary.left,
    daysLeftInMonth: lastDay - dayOfMonth + 1,
  });

  const thisWeek = weekStart(day);
  const dow = parseDay(day).getDay(); // 0 Sunday
  const reviewDue = dow === 0 || dow === 5 || dow === 6;

  return { month, summary, buckets, totals, insights, streak, recent, thisWeek, reviewDue };
}
