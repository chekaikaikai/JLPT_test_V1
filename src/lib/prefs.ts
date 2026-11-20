import type { Level, PracticeCount, PracticeConfig } from '../types';

// LocalStorage：只放少量介面偏好。
const KEY = 'jlpt.prefs.v1';
export interface LocalPrefs {
  level: Level;
  practiceCount: PracticeCount;
  practiceSubject: PracticeConfig['subject'];
}
const DEFAULTS: LocalPrefs = { level: 'N5', practiceCount: 10, practiceSubject: 'all' };

export function loadPrefs(): LocalPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}
export function savePrefs(p: LocalPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 隱私模式等情況下忽略 */
  }
}
