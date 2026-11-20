import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BUILTIN_BANK } from '../data/bank';
import { getDB } from '../lib/db';
import { isSupabaseConfigured } from '../lib/env';
import { indexBank, type BankIndex } from '../services/selection';
import { fetchApprovedBank } from '../services/sync';
import type { Passage, Question } from '../types';

export type BankSource = 'builtin' | 'cache' | 'cloud';
interface BankState {
  index: BankIndex;
  source: BankSource;
  updatedAt: string | null;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
const Ctx = createContext<BankState | null>(null);

/** 後者覆蓋前者（同 ID）：內建 < 本機快取的雲端題庫 < 最新雲端題庫。 */
function merge(base: { questions: Question[]; passages: Passage[] }, extra: { questions: Question[]; passages: Passage[] }) {
  const qm = new Map(base.questions.map((q) => [q.id, q]));
  extra.questions.forEach((q) => qm.set(q.id, q));
  const pm = new Map(base.passages.map((p) => [p.id, p]));
  extra.passages.forEach((p) => pm.set(p.id, p));
  return { questions: [...qm.values()], passages: [...pm.values()] };
}

export function BankProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(BUILTIN_BANK);
  const [source, setSource] = useState<BankSource>('builtin');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) 先讀 IndexedDB 內快取的雲端題庫（離線時也能用）
  useEffect(() => {
    (async () => {
      try {
        const db = await getDB();
        const [questions, passages, meta] = await Promise.all([db.getAll('questions'), db.getAll('passages'), db.get('meta', 'bankUpdatedAt')]);
        if (questions.length > 0) {
          setData(merge(BUILTIN_BANK, { questions, passages }));
          setSource('cache');
          setUpdatedAt((meta?.value as string) ?? null);
        }
      } catch {
        /* IndexedDB 不可用時仍可使用內建題庫 */
      }
    })();
  }, []);

  // 2) 有網路時從雲端更新
  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !navigator.onLine) return;
    setRefreshing(true);
    setError(null);
    try {
      const cloud = await fetchApprovedBank();
      const db = await getDB();
      const tx = db.transaction(['questions', 'passages', 'meta'], 'readwrite');
      await tx.objectStore('questions').clear();
      await tx.objectStore('passages').clear();
      for (const q of cloud.questions) await tx.objectStore('questions').put(q);
      for (const p of cloud.passages) await tx.objectStore('passages').put(p);
      const now = new Date().toISOString();
      await tx.objectStore('meta').put({ key: 'bankUpdatedAt', value: now });
      await tx.done;
      setData(merge(BUILTIN_BANK, cloud));
      setSource('cloud');
      setUpdatedAt(now);
    } catch (e) {
      setError(e instanceof Error ? e.message : '題庫更新失敗');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, [refresh]);

  const index = useMemo(() => indexBank(data.questions, data.passages), [data]);
  const value = useMemo(() => ({ index, source, updatedAt, refreshing, error, refresh }), [index, source, updatedAt, refreshing, error, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBank(): BankState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBank 必須在 BankProvider 內使用');
  return v;
}
