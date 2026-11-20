import type { GrammarNote, Level, Passage, PassageGenre, Question, QuestionType, VocabNote } from '../../types';
import { subjectOfType } from '../meta';

type V = [word: string, reading: string, meaning: string];
type G = [pattern: string, meaning: string];

interface Extra {
  note?: string;
  vocab?: V[];
  grammar?: G[];
  diff?: 1 | 2 | 3;
  passage?: Passage;
}

const CODE: Record<QuestionType, string> = {
  kanji_reading: 'kr',
  orthography: 'or',
  contextual: 'cx',
  paraphrase: 'pa',
  usage: 'us',
  grammar_form: 'gf',
  sentence_composition: 'sc',
  text_grammar: 'tg',
  reading_short: 'rs',
  reading_life: 'rl',
  reading_notice: 'rn',
  reading_mid: 'rm',
  reading_info: 'ri',
};

/**
 * 建立題目的小工具。作者以「1~4」填寫正確選項，內部轉成 0-based。
 * ID 格式：n5-kr-001（等級-題型-流水號），確保唯一且穩定。
 */
export function makeBuilder(level: Level) {
  const counters: Record<string, number> = {};
  let passageCount = 0;
  const pad = (n: number) => String(n).padStart(3, '0');

  const p = (genre: PassageGenre, body: string, title?: string): Passage => {
    passageCount += 1;
    return {
      id: `${level.toLowerCase()}-ps-${pad(passageCount)}`,
      level,
      genre,
      title,
      body: body.trim(),
      source: 'original',
      status: 'approved',
    };
  };

  const q = (
    type: QuestionType,
    stem: string,
    options: string[],
    answer: 1 | 2 | 3 | 4,
    explanationZh: string,
    extra: Extra = {},
  ): Question => {
    const code = CODE[type];
    counters[code] = (counters[code] ?? 0) + 1;
    return {
      id: `${level.toLowerCase()}-${code}-${pad(counters[code])}`,
      level,
      subject: subjectOfType(type),
      type,
      difficulty: extra.diff ?? (level === 'N5' ? 1 : 2),
      stem,
      passageId: extra.passage?.id,
      options,
      answerIndex: answer - 1,
      explanationZh,
      noteJa: extra.note,
      vocab: (extra.vocab ?? []).map(([word, reading, meaning]): VocabNote => ({ word, reading, meaning })),
      grammar: (extra.grammar ?? []).map(([pattern, meaning]): GrammarNote => ({ pattern, meaning })),
      source: 'original',
      status: 'approved',
    };
  };

  return { q, p };
}
