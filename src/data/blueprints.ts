import type { ExamKind, Level, QuestionType } from '../types';

/**
 * 模擬考規格（不含聽解）。
 *
 * 考試時間依日本語能力試験官方網站公布的現行規格：
 *   N5：言語知識（文字・語彙）20 分／言語知識（文法）・読解 40 分
 *   N4：言語知識（文字・語彙）25 分／言語知識（文法）・読解 55 分
 * （2020 年 12 月試験起施行；各回實際題數可能略有差異，此處採官方公布的題數目安。）
 *
 * N5 與 N4 的題型、題數與時間完全分開設定，不會混用。
 */
export interface ExamPart {
  label: string;
  types: QuestionType[];
  count: number;
}
export interface ExamSectionSpec {
  id: 'vocab' | 'grammar_reading';
  name: string;
  minutes: number;
  parts: ExamPart[];
}
export interface ExamBlueprint {
  level: Level;
  sections: ExamSectionSpec[];
}

const SHORT: QuestionType[] = ['reading_short', 'reading_life', 'reading_notice'];

export const EXAM_BLUEPRINTS: Record<Level, ExamBlueprint> = {
  N5: {
    level: 'N5',
    sections: [
      {
        id: 'vocab',
        name: '言語知識（文字・語彙）',
        minutes: 20,
        parts: [
          { label: 'もんだい１ 漢字読み', types: ['kanji_reading'], count: 7 },
          { label: 'もんだい２ 表記', types: ['orthography'], count: 5 },
          { label: 'もんだい３ 文脈規定', types: ['contextual'], count: 6 },
          { label: 'もんだい４ 言い換え類義', types: ['paraphrase'], count: 3 },
        ],
      },
      {
        id: 'grammar_reading',
        name: '言語知識（文法）・読解',
        minutes: 40,
        parts: [
          { label: 'もんだい１ 文の文法１（文法形式）', types: ['grammar_form'], count: 9 },
          { label: 'もんだい２ 文の文法２（文の組み立て）', types: ['sentence_composition'], count: 4 },
          { label: 'もんだい３ 文章の文法', types: ['text_grammar'], count: 4 },
          { label: 'もんだい４ 内容理解（短文）', types: SHORT, count: 2 },
          { label: 'もんだい５ 内容理解（中文）', types: ['reading_mid'], count: 2 },
          { label: 'もんだい６ 情報検索', types: ['reading_info'], count: 1 },
        ],
      },
    ],
  },
  N4: {
    level: 'N4',
    sections: [
      {
        id: 'vocab',
        name: '言語知識（文字・語彙）',
        minutes: 25,
        parts: [
          { label: 'もんだい１ 漢字読み', types: ['kanji_reading'], count: 7 },
          { label: 'もんだい２ 表記', types: ['orthography'], count: 5 },
          { label: 'もんだい３ 文脈規定', types: ['contextual'], count: 8 },
          { label: 'もんだい４ 言い換え類義', types: ['paraphrase'], count: 4 },
          { label: 'もんだい５ 用法', types: ['usage'], count: 4 },
        ],
      },
      {
        id: 'grammar_reading',
        name: '言語知識（文法）・読解',
        minutes: 55,
        parts: [
          { label: 'もんだい１ 文の文法１（文法形式）', types: ['grammar_form'], count: 13 },
          { label: 'もんだい２ 文の文法２（文の組み立て）', types: ['sentence_composition'], count: 4 },
          { label: 'もんだい３ 文章の文法', types: ['text_grammar'], count: 4 },
          { label: 'もんだい４ 内容理解（短文）', types: SHORT, count: 3 },
          { label: 'もんだい５ 内容理解（中文）', types: ['reading_mid'], count: 3 },
          { label: 'もんだい６ 情報検索', types: ['reading_info'], count: 2 },
        ],
      },
    ],
  },
};

export const EXAM_KIND_LABEL: Record<ExamKind, string> = {
  full: '完整模擬考',
  vocab: '文字・語彙（單節）',
  grammar_reading: '文法・讀解（單節）',
};

export function sectionsForKind(level: Level, kind: ExamKind): ExamSectionSpec[] {
  const all = EXAM_BLUEPRINTS[level].sections;
  if (kind === 'full') return all;
  return all.filter((s) => s.id === kind);
}

export function totalQuestions(sections: ExamSectionSpec[]): number {
  return sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + p.count, 0), 0);
}
export function totalMinutes(sections: ExamSectionSpec[]): number {
  return sections.reduce((n, s) => n + s.minutes, 0);
}
