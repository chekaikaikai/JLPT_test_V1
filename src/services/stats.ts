import type { Level, QuizSession, Subject } from '../types';
import { dayKey, pct } from '../utils';
import type { BankIndex } from './selection';

export function overall(sessions: QuizSession[]) {
  const total = sessions.reduce((n, s) => n + s.total, 0);
  const correct = sessions.reduce((n, s) => n + s.correct, 0);
  return { total, correct, accuracy: pct(correct, total) };
}

export function subjectProgress(sessions: QuizSession[], level: Level, index: BankIndex) {
  const seen = new Map<Subject, Set<string>>();
  const acc = new Map<Subject, { t: number; c: number }>();
  for (const s of sessions.filter((x) => x.level === level))
    for (const a of s.answers) {
      if (!seen.has(a.subject)) seen.set(a.subject, new Set());
      seen.get(a.subject)!.add(a.questionId);
      const x = acc.get(a.subject) ?? { t: 0, c: 0 };
      x.t += 1;
      if (a.isCorrect) x.c += 1;
      acc.set(a.subject, x);
    }
  return (['vocabulary', 'grammar', 'reading'] as Subject[]).map((subject) => {
    const bankTotal = index.questions.filter((q) => q.level === level && q.subject === subject).length;
    const done = seen.get(subject)?.size ?? 0;
    const a = acc.get(subject) ?? { t: 0, c: 0 };
    return { subject, bankTotal, done, coverage: pct(done, bankTotal), answered: a.t, accuracy: pct(a.c, a.t) };
  });
}

export function dailyCounts(sessions: QuizSession[], days = 14) {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(dayKey(s.finishedAt), (map.get(dayKey(s.finishedAt)) ?? 0) + s.total);
  const out: { label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: map.get(dayKey(d.toISOString())) ?? 0 });
  }
  return out;
}

function weekStart(iso: string): string {
  const d = new Date(iso);
  const diff = (d.getDay() + 6) % 7; // 週一為一週起點
  d.setDate(d.getDate() - diff);
  return dayKey(d.toISOString());
}

export function weeklyTrend(sessions: QuizSession[], weeks = 8) {
  const map = new Map<string, { t: number; c: number }>();
  for (const s of sessions) {
    const k = weekStart(s.finishedAt);
    const x = map.get(k) ?? { t: 0, c: 0 };
    x.t += s.total;
    x.c += s.correct;
    map.set(k, x);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-weeks)
    .map(([k, v]) => ({ label: k.slice(5).replace('-', '/'), accuracy: pct(v.c, v.t), count: v.t }));
}

/** 整體正確率變化：依時間順序，累計到每一次測驗為止的正確率。 */
export function accuracyTrend(sessions: QuizSession[]) {
  const sorted = [...sessions].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  let t = 0;
  let c = 0;
  return sorted.map((s, i) => {
    t += s.total;
    c += s.correct;
    return { label: `#${i + 1}`, cumulative: pct(c, t), session: pct(s.correct, s.total) };
  });
}

export function subjectCompare(sessions: QuizSession[]) {
  const m = new Map<Subject, { t: number; c: number }>();
  for (const s of sessions) for (const a of s.answers) {
    const x = m.get(a.subject) ?? { t: 0, c: 0 };
    x.t += 1;
    if (a.isCorrect) x.c += 1;
    m.set(a.subject, x);
  }
  return (['vocabulary', 'grammar', 'reading'] as Subject[]).map((s) => ({ subject: s, accuracy: pct(m.get(s)?.c ?? 0, m.get(s)?.t ?? 0), total: m.get(s)?.t ?? 0 }));
}
