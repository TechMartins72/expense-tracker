// The money structure: every income is split by whole-number percentages into buckets.
// What's left after the buckets is spendable. Rounding never creates money: each bucket
// is rounded down and any remainder stays spendable.

export type BucketShare = { bucketId: number; percentage: number };
export type SplitLine = { bucketId: number; percentage: number; amountDue: number };

export function validatePercentages(percentages: number[]): string | null {
  for (const p of percentages) {
    if (!Number.isInteger(p) || p < 0 || p > 100) return 'Each percentage must be a whole number from 0 to 100.';
  }
  const total = percentages.reduce((a, b) => a + b, 0);
  if (total > 100) return `The buckets add up to ${total}%. Keep them at 100% or less.`;
  return null;
}

export function splitIncome(amount: number, shares: BucketShare[]): { lines: SplitLine[]; spendable: number } {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('amount must be a non-negative integer');
  const err = validatePercentages(shares.map((s) => s.percentage));
  if (err) throw new Error(err);
  const lines = shares.map((s) => ({
    bucketId: s.bucketId,
    percentage: s.percentage,
    amountDue: Math.floor((amount * s.percentage) / 100),
  }));
  const spendable = amount - lines.reduce((a, l) => a + l.amountDue, 0);
  return { lines, spendable };
}

export type AllocationStatus = 'pending' | 'partial' | 'done';

export function statusFor(amountDue: number, amountMoved: number): AllocationStatus {
  if (amountMoved <= 0) return 'pending';
  if (amountMoved >= amountDue) return 'done';
  return 'partial';
}

/** Validate a "money moved" update. Moving more than is due is not allowed. */
export function checkMoved(amountDue: number, amountMoved: number): string | null {
  if (!Number.isSafeInteger(amountMoved) || amountMoved < 0) return 'Enter an amount of zero or more.';
  if (amountMoved > amountDue) return 'That is more than this allocation asks for.';
  return null;
}
