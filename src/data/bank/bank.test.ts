import { describe, expect, it } from 'vitest';
import { EXAM_BLUEPRINTS, sectionsForKind } from '../blueprints';
import { buildExam, buildPractice, indexBank } from '../../services/selection';
import { BUILTIN_BANK } from './index';
import type { Level } from '../../types';

describe('內建題庫品質', () => {
  const { questions, passages } = BUILTIN_BANK;
  it('ID 唯一', () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length);
  });
  it('每題 4 個不重複選項、答案索引合法、有解析', () => {
    for (const q of questions) {
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options).size, `${q.id} 選項重複`).toBe(4);
      expect(q.answerIndex, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex, q.id).toBeLessThan(4);
      expect(q.explanationZh.length, q.id).toBeGreaterThan(5);
    }
  });
  it('文章題都有對應文章且等級一致', () => {
    const pm = new Map(passages.map((p) => [p.id, p]));
    for (const q of questions) {
      if (q.subject === 'reading' || q.type === 'text_grammar') {
        expect(q.passageId, q.id).toBeTruthy();
        expect(pm.get(q.passageId!)?.level, q.id).toBe(q.level);
      }
    }
  });
  it('句子組合題含 ★ 且有 3 個空格', () => {
    for (const q of questions.filter((x) => x.type === 'sentence_composition')) {
      expect(q.stem.includes('★'), q.id).toBe(true);
      expect((q.stem.match(/＿＿＿/g) ?? []).length, q.id).toBe(3);
    }
  });
});

describe('模擬考抽題', () => {
  const idx = indexBank(BUILTIN_BANK.questions, BUILTIN_BANK.passages);
  for (const level of ['N5', 'N4'] as Level[]) {
    it(`${level} 完整模擬考符合規格、無重複、等級正確`, () => {
      const r = buildExam(idx, level, 'full');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const expected = EXAM_BLUEPRINTS[level].sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + p.count, 0), 0);
      expect(r.questionIds).toHaveLength(expected);
      expect(new Set(r.questionIds).size).toBe(expected);
      expect(r.questionIds.every((id) => idx.byId.get(id)!.level === level)).toBe(true);
      expect(r.sections.map((s) => s.minutes)).toEqual(sectionsForKind(level, 'full').map((s) => s.minutes));
    });
  }
  it('未審核題目不會被抽到', () => {
    const qs = BUILTIN_BANK.questions.map((q, i) => (i % 2 ? { ...q, status: 'pending' as const } : q));
    const r = buildExam(indexBank(qs, BUILTIN_BANK.passages), 'N5', 'full');
    expect(r.ok).toBe(false);
  });
  it('題庫不足時回報缺少項目而非降低規格', () => {
    const qs = BUILTIN_BANK.questions.filter((q) => q.type !== 'kanji_reading');
    const r = buildExam(indexBank(qs, BUILTIN_BANK.passages), 'N5', 'vocab');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.shortages[0]).toContain('漢字読み');
  });
});

describe('練習抽題', () => {
  const idx = indexBank(BUILTIN_BANK.questions, BUILTIN_BANK.passages);
  it('只含指定等級與科目，題目不重複', () => {
    const { questions } = buildPractice(idx, { level: 'N4', subject: 'grammar', types: [], count: 10, onlyWrong: false, onlyBookmarked: false }, new Set(), new Set());
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((q) => q.level === 'N4' && q.subject === 'grammar')).toBe(true);
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
  });
});
