import { sectionsForKind } from '../data/blueprints';
import type { ExamKind, ExamSectionState, Level, Passage, PracticeConfig, Question, Subject } from '../types';
import { shuffle } from '../utils';

export interface BankIndex {
  questions: Question[];
  byId: Map<string, Question>;
  passageById: Map<string, Passage>;
}

/** 建立索引。只保留「已審核（approved）」的題目與文章；pending / rejected 一律不會進入練習或模擬考。 */
export function indexBank(questions: Question[], passages: Passage[]): BankIndex {
  const okPassages = passages.filter((p) => p.status === 'approved');
  const passageById = new Map(okPassages.map((p) => [p.id, p]));
  const qs = questions.filter((q) => q.status === 'approved' && q.options.length === 4 && (!q.passageId || passageById.has(q.passageId)));
  return { questions: qs, byId: new Map(qs.map((q) => [q.id, q])), passageById };
}

/** 同一篇文章的題目視為一個單位，抽題時不拆開。 */
export function groupUnits(qs: Question[]): Question[][] {
  const groups = new Map<string, Question[]>();
  const units: Question[][] = [];
  for (const q of qs) {
    if (q.passageId) {
      const g = groups.get(q.passageId);
      if (g) g.push(q);
      else {
        const n = [q];
        groups.set(q.passageId, n);
        units.push(n);
      }
    } else units.push([q]);
  }
  return units;
}

/** 隨機挑出總題數剛好等於 count 的單位組合；做不到則回傳 null（題庫不足）。 */
export function pickUnits(units: Question[][], count: number): Question[] | null {
  const pool = shuffle(units);
  let nodes = 0;
  const dfs = (i: number, remaining: number, chosen: Question[][]): Question[][] | null => {
    if (remaining === 0) return chosen;
    if (i >= pool.length || nodes++ > 20000) return null;
    const u = pool[i];
    if (u.length <= remaining) {
      const r = dfs(i + 1, remaining - u.length, [...chosen, u]);
      if (r) return r;
    }
    return dfs(i + 1, remaining, chosen);
  };
  const res = dfs(0, count, []);
  return res ? res.flat() : null;
}

export interface PracticeSelection {
  questions: Question[];
  poolSize: number;
}

export function buildPractice(index: BankIndex, config: PracticeConfig, wrongIds: Set<string>, bookmarkIds: Set<string>): PracticeSelection {
  let pool = index.questions.filter((q) => q.level === config.level);
  if (config.ids) {
    const set = new Set(config.ids);
    pool = pool.filter((q) => set.has(q.id));
  } else {
    if (config.subject !== 'all') pool = pool.filter((q) => q.subject === config.subject);
    if (config.types.length > 0) pool = pool.filter((q) => config.types.includes(q.type));
    if (config.onlyWrong || config.onlyBookmarked) {
      pool = pool.filter((q) => (config.onlyWrong && wrongIds.has(q.id)) || (config.onlyBookmarked && bookmarkIds.has(q.id)));
    }
  }
  const units = shuffle(groupUnits(pool));
  if (config.count === 'all' || config.ids) return { questions: units.flat(), poolSize: pool.length };
  const limit = config.count;
  const picked: Question[] = [];
  for (const u of units) if (picked.length + u.length <= limit) picked.push(...u);
  if (picked.length === 0 && units.length > 0) picked.push(...units[0]);
  return { questions: picked, poolSize: pool.length };
}

export type ExamBuild =
  | { ok: true; questionIds: string[]; sections: ExamSectionState[] }
  | { ok: false; shortages: string[] };

/** 依該等級的考試規格抽題。題庫不足時回報缺少的大題，絕不偷偷降低規格。 */
export function buildExam(index: BankIndex, level: Level, kind: ExamKind): ExamBuild {
  const specs = sectionsForKind(level, kind);
  const used = new Set<string>();
  const ids: string[] = [];
  const sections: ExamSectionState[] = [];
  const shortages: string[] = [];

  for (const spec of specs) {
    const start = ids.length;
    for (const part of spec.parts) {
      const pool = index.questions.filter((q) => q.level === level && part.types.includes(q.type) && !used.has(q.id));
      const picked = pickUnits(groupUnits(pool), part.count);
      if (!picked) {
        shortages.push(`${spec.name}／${part.label}：需要 ${part.count} 題，題庫目前無法組成（可用 ${pool.length} 題）`);
        continue;
      }
      for (const q of picked) {
        used.add(q.id);
        ids.push(q.id);
      }
    }
    sections.push({ id: spec.id, name: spec.name, minutes: spec.minutes, start, end: ids.length });
  }
  return shortages.length > 0 ? { ok: false, shortages } : { ok: true, questionIds: ids, sections };
}

export interface SubjectStat {
  subject: Subject;
  total: number;
  correct: number;
}
export function subjectBreakdown(answers: { subject: Subject; isCorrect: boolean }[]): SubjectStat[] {
  const m = new Map<Subject, SubjectStat>();
  for (const a of answers) {
    const s = m.get(a.subject) ?? { subject: a.subject, total: 0, correct: 0 };
    s.total += 1;
    if (a.isCorrect) s.correct += 1;
    m.set(a.subject, s);
  }
  return (['vocabulary', 'grammar', 'reading'] as Subject[]).filter((k) => m.has(k)).map((k) => m.get(k)!);
}
