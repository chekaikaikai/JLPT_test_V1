import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env';

/**
 * 只使用 anon key。所有資料存取皆受 Row Level Security 保護。
 * 未設定環境變數時為 null，App 會以「僅訪客模式」運作。
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** 驗證信 / 重設密碼信的導回網址（HashRouter 友善：不含 #，由 App 依事件導向）。 */
export function appUrl(query = ''): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${query}`;
}
