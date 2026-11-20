import { describe, expect, it } from 'vitest';
import { convert, formatMoney, formatRate, minorToInput, parseMinor, parseRate, rateFromApi } from './money';
import { checkMoved, splitIncome, statusFor, validatePercentages } from './split';
import { addDays, addMonths, dayLabel, weekStart } from './dates';
import { loggingStreak } from './streak';
import { budgetLevel, buildInsights } from './insights';

describe('money', () => {
  it('parses typed amounts into minor units without floats', () => {
    expect(parseMinor('1500')).toBe(150000);
    expect(parseMinor('12.5')).toBe(1250);
    expect(parseMinor('0.07')).toBe(7);
    expect(parseMinor('0.1')).toBe(10);
    expect(parseMinor('1,250.99')).toBe(125099);
    expect(parseMinor('1.')).toBe(100);
    for (const bad of ['', '.', '1.234', '-5', 'abc', '1e3', '9999999999999']) expect(parseMinor(bad)).toBeNull();
  });

  it('round-trips the pad text', () => {
    expect(minorToInput(150050)).toBe('1500.5');
    expect(minorToInput(7)).toBe('0.07');
    expect(minorToInput(100)).toBe('1');
  });

  it('formats with symbol and grouping', () => {
    expect(formatMoney(123456789, 'NGN')).toBe('₦1,234,567.89');
    expect(formatMoney(-310, 'USD')).toBe('-$3.10');
    expect(formatMoney(500000, 'NGN', { compact: true })).toBe('₦5,000');
    expect(formatMoney(500050, 'NGN', { compact: true })).toBe('₦5,000.50');
    expect(formatMoney(100, 'USD', { sign: true })).toBe('+$1.00');
  });

  it('parses and formats rates as integers x1000', () => {
    expect(parseRate('1550.25')).toBe(1550250);
    expect(parseRate('0')).toBeNull();
    expect(formatRate(1550250)).toBe('1,550.25');
    expect(rateFromApi(1550.2531)).toBe(1550253);
    expect(rateFromApi('1550')).toBeNull();
  });

  it('converts using the stored rate', () => {
    const rate = 1_500_000; // ₦1,500 per $1
    expect(convert(100, 'USD', 'NGN', rate)).toBe(150000); // $1 -> ₦1,500
    expect(convert(150000, 'NGN', 'USD', rate)).toBe(100);
    expect(convert(1, 'NGN', 'USD', rate)).toBe(0);
    expect(convert(-100, 'USD', 'NGN', rate)).toBe(-150000);
    expect(convert(42, 'NGN', 'NGN', rate)).toBe(42);
  });
});

describe('split', () => {
  const shares = [
    { bucketId: 1, percentage: 25 },
    { bucketId: 2, percentage: 10 },
    { bucketId: 3, percentage: 10 },
  ];

  it('splits by the defaults and leaves 55% spendable', () => {
    const r = splitIncome(100000_00, shares);
    expect(r.lines.map((l) => l.amountDue)).toEqual([25000_00, 10000_00, 10000_00]);
    expect(r.spendable).toBe(55000_00);
  });

  it('rounds buckets down so the parts always add back up', () => {
    const r = splitIncome(333, shares);
    expect(r.lines.map((l) => l.amountDue)).toEqual([83, 33, 33]);
    expect(r.spendable + r.lines.reduce((a, l) => a + l.amountDue, 0)).toBe(333);
  });

  it('refuses percentages over 100 in total', () => {
    expect(validatePercentages([60, 30, 20])).toMatch(/110%/);
    expect(validatePercentages([25, 10.5, 10])).toMatch(/whole/);
    expect(() => splitIncome(100, [{ bucketId: 1, percentage: 101 }])).toThrow();
  });

  it('tracks pending, partial and done', () => {
    expect(statusFor(1000, 0)).toBe('pending');
    expect(statusFor(1000, 400)).toBe('partial');
    expect(statusFor(1000, 1000)).toBe('done');
    expect(statusFor(0, 0)).toBe('pending');
    expect(checkMoved(1000, 1001)).not.toBeNull();
    expect(checkMoved(1000, -1)).not.toBeNull();
    expect(checkMoved(1000, 1000)).toBeNull();
  });
});

describe('dates and streak', () => {
  it('does calendar arithmetic', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday -> Monday
    expect(dayLabel('2026-11-20', '2026-11-20')).toBe('Today');
    expect(dayLabel('2026-11-19', '2026-11-20')).toBe('Yesterday');
    expect(dayLabel('2026-11-02', '2026-11-20')).toBe('2 Nov');
  });

  it('counts a streak that is still alive until the day ends', () => {
    const days = ['2026-11-17', '2026-11-18', '2026-11-19'];
    expect(loggingStreak(days, '2026-11-20')).toEqual({ days: 3, loggedToday: false });
    expect(loggingStreak([...days, '2026-11-20'], '2026-11-20')).toEqual({ days: 4, loggedToday: true });
    expect(loggingStreak(['2026-11-17'], '2026-11-20')).toEqual({ days: 0, loggedToday: false });
  });
});

describe('insights', () => {
  it('warns at 80% and 100%', () => {
    expect(budgetLevel(79, 100)).toBe('ok');
    expect(budgetLevel(80, 100)).toBe('warn');
    expect(budgetLevel(100, 100)).toBe('over');
  });

  it('puts problems first', () => {
    const list = buildInsights({
      currency: 'NGN',
      categories: [{ name: 'Food', thisMonth: 30000_00, lastMonthSameDay: 20000_00 }],
      budgets: [{ name: 'Transport', spent: 12000_00, limit: 10000_00 }],
      pendingBuckets: [{ name: 'Tithe', pending: 5000_00 }],
      streak: { days: 5, loggedToday: true },
      spendableLeft: 10000_00,
      daysLeftInMonth: 10,
    });
    expect(list[0].title).toBe('Transport is over budget');
    expect(list.map((i) => i.id)).toContain('mom-up-Food');
    expect(list.find((i) => i.id === 'mom-up-Food')!.title).toBe('Food is up 50% on last month');
    expect(list.at(-1)!.id).toBe('streak');
  });
});
