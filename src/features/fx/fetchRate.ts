import { getNetworkStateAsync } from 'expo-network';
import { rateFromApi } from '../../lib/money';

// Free, keyless endpoint updated daily. Display/entry convenience only: the user can always
// override the rate in Settings, and offline the last known rate is used.
const URL = 'https://open.er-api.com/v6/latest/USD';

export async function fetchUsdNgnRate(): Promise<{ kind: 'ok'; rateMilli: number } | { kind: 'offline' } | { kind: 'failed' }> {
  try {
    const net = await getNetworkStateAsync();
    if (net.isInternetReachable === false || net.isConnected === false) return { kind: 'offline' };
  } catch {
    // If the network state is unknown, just try.
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(URL, { signal: ctrl.signal });
    if (!res.ok) return { kind: 'failed' };
    const body = (await res.json()) as { result?: string; rates?: Record<string, unknown> };
    const rateMilli = body.result === 'success' ? rateFromApi(body.rates?.NGN) : null;
    return rateMilli ? { kind: 'ok', rateMilli } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
