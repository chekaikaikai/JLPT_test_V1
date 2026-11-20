import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BookmarkRecord, Question, QuizSession, Scope, WrongRecord } from '../types';
import { GUEST_SCOPE } from '../types';
import * as repo from '../services/repository';
import { syncAll } from '../services/sync';
import { useAuth } from './AuthContext';

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'error';
interface UserDataState {
  scope: Scope;
  isGuest: boolean;
  loading: boolean;
  sessions: QuizSession[];
  bookmarks: BookmarkRecord[];
  wrongs: WrongRecord[];
  bookmarkIds: Set<string>;
  wrongIds: Set<string>;
  sync: { status: SyncStatus; pending: number; error: string | null; lastSyncAt: string | null };
  reload: () => Promise<void>;
  syncNow: () => Promise<void>;
  toggleBookmark: (q: Question) => Promise<boolean>;
  recordWrong: (q: Question, selected: number | null) => Promise<void>;
  removeWrong: (id: string) => Promise<void>;
  saveSession: (s: QuizSession) => Promise<boolean>;
}
const Ctx = createContext<UserDataState | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { userId, configured } = useAuth();
  const scope: Scope = userId ?? GUEST_SCOPE;
  const isGuest = !userId;

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [wrongs, setWrongs] = useState<WrongRecord[]>([]);
  const [sync, setSync] = useState<UserDataState['sync']>({ status: 'local', pending: 0, error: null, lastSyncAt: null });
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => {
    const [s, b, w, pending] = await Promise.all([repo.listSessions(scope), repo.listBookmarks(scope), repo.listWrongs(scope), repo.countOutbox(scope)]);
    setSessions(s);
    setBookmarks(b);
    setWrongs(w);
    setSync((x) => ({ ...x, pending }));
  }, [scope]);

  const syncNow = useCallback(async () => {
    if (!userId || !configured) return;
    if (!navigator.onLine) {
      setSync((x) => ({ ...x, status: 'idle' }));
      return;
    }
    if (inflight.current) return inflight.current;
    setSync((x) => ({ ...x, status: 'syncing', error: null }));
    inflight.current = (async () => {
      try {
        await syncAll(userId);
        await reload();
        setSync((x) => ({ ...x, status: 'idle', error: null, lastSyncAt: new Date().toISOString() }));
      } catch (e) {
        setSync((x) => ({ ...x, status: 'error', error: e instanceof Error ? e.message : '同步失敗' }));
      } finally {
        inflight.current = null;
        setSync((x) => ({ ...x }));
      }
    })();
    return inflight.current;
  }, [userId, configured, reload]);

  const scheduleSync = useCallback(() => {
    if (!userId) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void syncNow(), 800);
  }, [userId, syncNow]);

  // scope 改變（登入 / 登出）時重新載入並同步
  useEffect(() => {
    setLoading(true);
    setSync({ status: userId ? 'idle' : 'local', pending: 0, error: null, lastSyncAt: null });
    reload().finally(() => setLoading(false));
    if (userId) void syncNow();
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  // 恢復網路、定時重試
  useEffect(() => {
    if (!userId) return;
    const on = () => void syncNow();
    window.addEventListener('online', on);
    const iv = window.setInterval(on, 60_000);
    return () => {
      window.removeEventListener('online', on);
      window.clearInterval(iv);
    };
  }, [userId, syncNow]);

  const toggleBookmark = useCallback(async (q: Question) => {
    const r = await repo.toggleBookmark(scope, q);
    await reload();
    scheduleSync();
    return r;
  }, [scope, reload, scheduleSync]);
  const recordWrong = useCallback(async (q: Question, sel: number | null) => {
    await repo.recordWrong(scope, q, sel);
    await reload();
    scheduleSync();
  }, [scope, reload, scheduleSync]);
  const removeWrong = useCallback(async (id: string) => {
    await repo.removeWrong(scope, id);
    await reload();
    scheduleSync();
  }, [scope, reload, scheduleSync]);
  const saveSession = useCallback(async (s: QuizSession) => {
    const ok = await repo.saveSession(scope, s);
    await reload();
    scheduleSync();
    return ok;
  }, [scope, reload, scheduleSync]);

  const bookmarkIds = useMemo(() => new Set(bookmarks.map((b) => b.questionId)), [bookmarks]);
  const wrongIds = useMemo(() => new Set(wrongs.map((w) => w.questionId)), [wrongs]);

  const value = useMemo<UserDataState>(
    () => ({ scope, isGuest, loading, sessions, bookmarks, wrongs, bookmarkIds, wrongIds, sync, reload, syncNow, toggleBookmark, recordWrong, removeWrong, saveSession }),
    [scope, isGuest, loading, sessions, bookmarks, wrongs, bookmarkIds, wrongIds, sync, reload, syncNow, toggleBookmark, recordWrong, removeWrong, saveSession],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserData(): UserDataState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUserData 必須在 UserDataProvider 內使用');
  return v;
}
