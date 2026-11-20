import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { getSettings, setSettings, type Settings } from '../db/repo';
import { fetchUsdNgnRate } from '../features/fx/fetchRate';

type AppState = {
  db: SQLiteDatabase;
  settings: Settings;
  /** Bumped after every write so open screens reload. */
  version: number;
  changed: () => Promise<void>;
  updateSettings: (values: Partial<Record<keyof Settings, string | number>>) => Promise<void>;
  refreshRate: () => Promise<'updated' | 'offline' | 'failed'>;
};

const Ctx = createContext<AppState | null>(null);

const RATE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function AppStateProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setLocal] = useState(initial);
  const [version, setVersion] = useState(0);

  const changed = useCallback(async () => {
    setLocal(await getSettings(db));
    setVersion((v) => v + 1);
  }, [db]);

  const updateSettings = useCallback(
    async (values: Partial<Record<keyof Settings, string | number>>) => {
      await setSettings(db, values);
      await changed();
    },
    [db, changed],
  );

  const refreshRate = useCallback(async () => {
    const r = await fetchUsdNgnRate();
    if (r.kind !== 'ok') return r.kind;
    await updateSettings({ last_fx_rate: r.rateMilli, fx_source: 'live', fx_updated_at: new Date().toISOString() });
    return 'updated' as const;
  }, [updateSettings]);

  // On launch, refresh a stale automatic rate in the background. A manual rate is never overwritten.
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    const age = settings.fx_updated_at ? Date.now() - Date.parse(settings.fx_updated_at) : Infinity;
    if (settings.fx_source !== 'manual' && !(age < RATE_MAX_AGE_MS)) void refreshRate();
  }, [settings, refreshRate]);

  return (
    <Ctx.Provider value={{ db, settings, version, changed, updateSettings, refreshRate }}>{children}</Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}

/**
 * Load data for a screen. Re-runs when the screen gains focus and after any write.
 * `deps` are the loader's own inputs (filters, ids).
 */
export function useQuery<T>(load: (db: SQLiteDatabase) => Promise<T>, deps: unknown[]): { data: T | undefined; reload: () => void } {
  const { db, version } = useApp();
  const [data, setData] = useState<T>();
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    const n = ++seq.current;
    load(db).then(
      (d) => { if (n === seq.current) setData(d); },
      (e) => console.warn('query failed', e),
    );
  }, [db, version, ...deps]);
  // Runs on focus, and again whenever `run` changes while focused (a write or new deps).
  useFocusEffect(run);
  return { data, reload: run };
}
