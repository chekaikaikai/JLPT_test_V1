import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadPrefs, savePrefs, type LocalPrefs } from '../lib/prefs';
import type { Level } from '../types';
import { useAuth } from './AuthContext';

interface PrefsState extends LocalPrefs {
  setLevel: (l: Level) => void;
  update: (patch: Partial<LocalPrefs>) => void;
}
const Ctx = createContext<PrefsState | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<LocalPrefs>(loadPrefs);
  const { profile, updateProfile } = useAuth();
  const adopted = useRef<string | null>(null);

  // 登入後採用雲端偏好（只在每個帳號第一次載入時）
  useEffect(() => {
    if (profile && adopted.current !== profile.id) {
      adopted.current = profile.id;
      const lv = profile.preferences.level;
      if (lv && lv !== prefs.level) setPrefs((p) => ({ ...p, level: lv }));
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => savePrefs(prefs), [prefs]);

  const value = useMemo<PrefsState>(
    () => ({
      ...prefs,
      update: (patch) => setPrefs((p) => ({ ...p, ...patch })),
      setLevel: (level) => {
        setPrefs((p) => ({ ...p, level }));
        if (profile) updateProfile({ preferences: { level } }).catch(() => undefined);
      },
    }),
    [prefs, profile, updateProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs 必須在 PrefsProvider 內使用');
  return v;
}
