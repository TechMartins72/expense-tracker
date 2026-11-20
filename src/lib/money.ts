// Money is always an integer number of minor units (kobo for NGN, cents for USD).
// Never store or add decimals: parse and format through these helpers only.

export type Currency = 'NGN' | 'USD';
export const CURRENCIES: Currency[] = ['NGN', 'USD'];

export const SYMBOL: Record<Currency, string> = { NGN: '₦', USD: '$' };

/** Largest amount accepted from the number pad: 999,999,999.99 */
export const MAX_MINOR = 99_999_999_999;

/**
 * Parse what the user typed ("1500", "12.5", "0.07") into minor units.
 * Returns null for anything that is not a plain positive amount with at most 2 decimals.
 */
export function parseMinor(input: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return null;
  return minor;
}

/** The pad's text for an amount already in minor units, e.g. 150050 -> "1500.5". */
export function minorToInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = String(minor % 100).padStart(2, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * ₦12,500.00 / -$3.10. `compact` drops ".00" (and kobo/cents entirely for large NGN amounts
 * in tight spaces).
 */
export function formatMoney(
  minor: number,
  currency: Currency,
  opts: { compact?: boolean; sign?: boolean } = {},
): string {
  const neg = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  let body = group(whole);
  if (!opts.compact || frac !== 0) body += '.' + String(frac).padStart(2, '0');
  const sign = neg ? '-' : opts.sign ? '+' : '';
  return `${sign}${SYMBOL[currency]}${body}`;
}

// --- Exchange rates -----------------------------------------------------------------------
// A rate is stored as an integer: naira per US dollar x 1000 (1550.25 -> 1_550_250).
// Since 1 USD = R NGN, 1 cent = R kobo, so cents -> kobo is cents * rateMilli / 1000.

export const RATE_SCALE = 1000;

export function parseRate(input: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{0,3})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const milli = Number(whole) * RATE_SCALE + Number(frac.padEnd(3, '0'));
  return milli > 0 && Number.isSafeInteger(milli) ? milli : null;
}

/** Rate from an API (a JS number like 1550.2531) to rate-milli. Only used at the network edge. */
export function rateFromApi(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return parseRate(value.toFixed(3));
}

export function formatRate(milli: number): string {
  const whole = Math.floor(milli / RATE_SCALE);
  const frac = String(milli % RATE_SCALE).padStart(3, '0').replace(/0+$/, '');
  return `${group(whole)}${frac ? '.' + frac : ''}`;
}

/** Convert an amount to `to`, using the rate stored with it. Rounds half away from zero. */
export function convert(minor: number, from: Currency, to: Currency, rateMilli: number): number {
  if (from === to) return minor;
  if (rateMilli <= 0) throw new Error('rate must be positive');
  const num = from === 'USD' ? minor * rateMilli : minor * RATE_SCALE;
  const den = from === 'USD' ? RATE_SCALE : rateMilli;
  const q = Math.round(Math.abs(num) / den);
  return num < 0 ? -q : q;
}
