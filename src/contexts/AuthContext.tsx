import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../lib/env';
import { appUrl, supabase } from '../lib/supabase';
import type { Profile, UserPreferences } from '../types';

interface AuthState {
  configured: boolean;
  loading: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  /** 使用者從重設密碼信件回到網站後為 true */
  recovering: boolean;
  signUp: (email: string, password: string, nickname: string) => Promise<{ needsConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (patch: { nickname?: string; preferences?: UserPreferences }) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Email 或密碼不正確。';
  if (m.includes('already registered') || m.includes('already been registered')) return '這個 Email 已經註冊過了，請直接登入。';
  if (m.includes('email not confirmed')) return '請先到信箱點擊驗證連結，再登入。';
  if (m.includes('password should be')) return '密碼強度不足，請至少使用 8 個字元。';
  if (m.includes('rate limit')) return '操作太頻繁，請稍後再試。';
  if (m.includes('failed to fetch') || m.includes('network')) return '網路連線失敗，請檢查網路後再試。';
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setProfile(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? null;

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (cancelled) return;
      if (data) {
        setProfile({ id: data.id, email: data.email, nickname: data.nickname, createdAt: data.created_at, preferences: data.preferences ?? {} });
      } else {
        // 觸發器尚未建立時的保險：自行建立自己的 profile（RLS 只允許 id = auth.uid()）
        const nickname = (session?.user.user_metadata?.nickname as string | undefined) ?? email?.split('@')[0] ?? '學習者';
        const { data: ins } = await supabase!.from('profiles').upsert({ id: userId, email, nickname }).select().maybeSingle();
        if (ins && !cancelled) setProfile({ id: ins.id, email: ins.email, nickname: ins.nickname, createdAt: ins.created_at, preferences: ins.preferences ?? {} });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const need = () => {
    if (!supabase) throw new Error('尚未設定 Supabase，目前只能使用訪客模式。');
    return supabase;
  };

  const signUp: AuthState['signUp'] = useCallback(async (em, password, nickname) => {
    const { data, error } = await need().auth.signUp({ email: em.trim(), password, options: { data: { nickname }, emailRedirectTo: appUrl() } });
    if (error) throw new Error(translateError(error.message));
    return { needsConfirm: !data.session };
  }, []);
  const signIn: AuthState['signIn'] = useCallback(async (em, password) => {
    const { error } = await need().auth.signInWithPassword({ email: em.trim(), password });
    if (error) throw new Error(translateError(error.message));
  }, []);
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setProfile(null);
  }, []);
  const sendReset: AuthState['sendReset'] = useCallback(async (em) => {
    // 不含 #：Supabase 會在網址後加上 ?code=…，App 收到 PASSWORD_RECOVERY 事件後導向重設頁
    const { error } = await need().auth.resetPasswordForEmail(em.trim(), { redirectTo: appUrl('?reset=1') });
    if (error) throw new Error(translateError(error.message));
  }, []);
  const updatePassword: AuthState['updatePassword'] = useCallback(async (pw) => {
    const { error } = await need().auth.updateUser({ password: pw });
    if (error) throw new Error(translateError(error.message));
    setRecovering(false);
  }, []);
  const updateProfile: AuthState['updateProfile'] = useCallback(
    async (patch) => {
      if (!userId) return;
      const next = {
        nickname: patch.nickname ?? profile?.nickname,
        preferences: { ...(profile?.preferences ?? {}), ...(patch.preferences ?? {}) },
      };
      const { error } = await need().from('profiles').update(next).eq('id', userId);
      if (error) throw new Error(translateError(error.message));
      setProfile((p) => (p ? { ...p, nickname: next.nickname ?? p.nickname, preferences: next.preferences } : p));
    },
    [userId, profile],
  );

  const value = useMemo<AuthState>(
    () => ({ configured: isSupabaseConfigured, loading, userId, email, profile, recovering, signUp, signIn, signOut, sendReset, updatePassword, updateProfile }),
    [loading, userId, email, profile, recovering, signUp, signIn, signOut, sendReset, updatePassword, updateProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth 必須在 AuthProvider 內使用');
  return v;
}
