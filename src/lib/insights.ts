// Offline, rule-based insights. Pure: the caller gathers the numbers (already converted to
// one display currency) and this decides what is worth saying.
import { Currency, formatMoney } from './money';

export type BudgetLevel = 'ok' | 'warn' | 'over';

/** Warnings at 80% and 100% of the limit. */
export function budgetLevel(spent: number, limit: number): BudgetLevel {
  if (limit <= 0) return spent > 0 ? 'over' : 'ok';
  if (spent >= limit) return 'over';
  if (spent * 100 >= limit * 80) return 'warn';
  return 'ok';
}

export type Insight = {
  id: string;
  tone: 'good' | 'neutral' | 'warn' | 'bad';
  icon: string; // MaterialCommunityIcons name
  title: string;
  body: string;
};

export type InsightInput = {
  currency: Currency;
  categories: { name: string; thisMonth: number; lastMonthSameDay: number }[];
  budgets: { name: string; spent: number; limit: number }[];
  pendingBuckets: { name: string; pending: number }[];
  streak: { days: number; loggedToday: boolean };
  spendableLeft: number;
  daysLeftInMonth: number;
};

export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const fmt = (n: number) => formatMoney(n, i.currency, { compact: true });

  for (const b of i.budgets) {
    const level = budgetLevel(b.spent, b.limit);
    if (level === 'over') {
      out.push({
        id: `budget-over-${b.name}`,
        tone: 'bad',
        icon: 'alert-octagon-outline',
        title: `${b.name} is over budget`,
        body: `You've spent ${fmt(b.spent)} of ${fmt(b.limit)} this month.`,
      });
    } else if (level === 'warn') {
      out.push({
        id: `budget-warn-${b.name}`,
        tone: 'warn',
        icon: 'alert-outline',
        title: `${b.name} is at ${Math.floor((b.spent * 100) / b.limit)}% of its budget`,
        body: `${fmt(b.limit - b.spent)} left for the rest of the month.`,
      });
    }
  }

  const pending = i.pendingBuckets.filter((p) => p.pending > 0);
  if (pending.length) {
    const total = pending.reduce((a, p) => a + p.pending, 0);
    out.push({
      id: 'pending-buckets',
      tone: 'neutral',
      icon: 'tray-arrow-down',
      title: `${fmt(total)} still to set aside`,
      body: pending.map((p) => `${p.name} ${fmt(p.pending)}`).join(' · '),
    });
  }

  // Month over month, compared at the same point in the month so early-month numbers are fair.
  const changes = i.categories
    .filter((c) => c.lastMonthSameDay > 0 || c.thisMonth > 0)
    .map((c) => ({ ...c, delta: c.thisMonth - c.lastMonthSameDay }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const up = changes.find((c) => c.delta > 0 && c.lastMonthSameDay > 0 && c.delta * 100 >= c.lastMonthSameDay * 20);
  if (up) {
    const pct = Math.round((up.delta * 100) / up.lastMonthSameDay);
    out.push({
      id: `mom-up-${up.name}`,
      tone: 'warn',
      icon: 'trending-up',
      title: `${up.name} is up ${pct}% on last month`,
      body: `${fmt(up.thisMonth)} so far, against ${fmt(up.lastMonthSameDay)} by this point last month.`,
    });
  }
  const down = changes.find((c) => c.delta < 0 && c.lastMonthSameDay > 0 && -c.delta * 100 >= c.lastMonthSameDay * 20);
  if (down) {
    const pct = Math.round((-down.delta * 100) / down.lastMonthSameDay);
    out.push({
      id: `mom-down-${down.name}`,
      tone: 'good',
      icon: 'trending-down',
      title: `${down.name} is down ${pct}% on last month`,
      body: `You've saved ${fmt(-down.delta)} there so far. Keep it up.`,
    });
  }

  if (i.spendableLeft < 0) {
    out.push({
      id: 'overspent',
      tone: 'bad',
      icon: 'wallet-outline',
      title: 'Spending is ahead of income',
      body: `You've spent ${fmt(-i.spendableLeft)} more than your spendable income this month.`,
    });
  } else if (i.daysLeftInMonth > 0 && i.spendableLeft > 0) {
    out.push({
      id: 'daily-allowance',
      tone: 'neutral',
      icon: 'calendar-today',
      title: `About ${fmt(Math.floor(i.spendableLeft / i.daysLeftInMonth))} a day`,
      body: `That's what's left to spend per day until the month ends.`,
    });
  }

  const s = i.streak;
  if (s.days >= 2) {
    out.push({
      id: 'streak',
      tone: 'good',
      icon: 'fire',
      title: `${s.days}-day logging streak`,
      body: s.loggedToday ? 'Nicely done. See you tomorrow.' : 'Log something today to keep it going.',
    });
  } else if (!s.loggedToday) {
    out.push({
      id: 'streak-start',
      tone: 'neutral',
      icon: 'fire',
      title: 'Start a logging streak',
      body: 'Record one expense or income each day. It takes five seconds.',
    });
  }

  const rank = { bad: 0, warn: 1, neutral: 2, good: 3 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
