import type { PassageGenre, QuestionType, Subject } from '../types';

export const SUBJECT_META: Record<Subject, { label: string; ja: string; description: string }> = {
  vocabulary: { label: '文字・語彙', ja: '文字・語彙', description: '漢字讀音、表記、詞彙與用法' },
  grammar: { label: '文法', ja: '文法', description: '文法形式、句子組合、文章文法' },
  reading: { label: '讀解', ja: '読解', description: '短文、中文、通知與資訊檢索' },
};

export const TYPE_META: Record<QuestionType, { subject: Subject; label: string; ja: string; hint: string }> = {
  kanji_reading: { subject: 'vocabulary', label: '漢字讀音', ja: '漢字読み', hint: '選出底線漢字的正確讀音。' },
  orthography: { subject: 'vocabulary', label: '漢字選擇', ja: '表記', hint: '選出底線假名對應的正確漢字或片假名。' },
  contextual: { subject: 'vocabulary', label: '文脈規定', ja: '文脈規定', hint: '選出最適合填入括號的詞語。' },
  paraphrase: { subject: 'vocabulary', label: '近義表現', ja: '言い換え類義', hint: '選出與底線部分意思最接近的說法。' },
  usage: { subject: 'vocabulary', label: '用法', ja: '用法', hint: '選出最適當地使用了該詞語的句子。' },
  grammar_form: { subject: 'grammar', label: '文法形式', ja: '文の文法１', hint: '選出最適合填入括號的文法形式。' },
  sentence_composition: { subject: 'grammar', label: '句子組合', ja: '文の文法２', hint: '將詞語排成正確順序，選出放在 ★ 位置的選項。' },
  text_grammar: { subject: 'grammar', label: '文章文法', ja: '文章の文法', hint: '閱讀文章，選出適合填入（　）的語句。' },
  reading_short: { subject: 'reading', label: '短篇理解', ja: '内容理解（短文）', hint: '閱讀短文，回答問題。' },
  reading_life: { subject: 'reading', label: '生活情境', ja: '内容理解（生活）', hint: '閱讀生活情境的文章，回答問題。' },
  reading_notice: { subject: 'reading', label: '通知・公告・郵件', ja: '内容理解（お知らせ）', hint: '閱讀通知、公告或電子郵件，回答問題。' },
  reading_mid: { subject: 'reading', label: '中篇理解', ja: '内容理解（中文）', hint: '閱讀中篇文章，回答問題。' },
  reading_info: { subject: 'reading', label: '資訊檢索', ja: '情報検索', hint: '從資訊中找出符合條件的內容。' },
};

export const GENRE_LABEL: Record<PassageGenre, string> = {
  essay: '短文',
  life: '生活',
  notice: '通知',
  email: '電子郵件',
  info: '資訊',
  blank: '文章',
};

export function typesOfSubject(subject: Subject): QuestionType[] {
  return (Object.keys(TYPE_META) as QuestionType[]).filter((t) => TYPE_META[t].subject === subject);
}

export function subjectOfType(type: QuestionType): Subject {
  return TYPE_META[type].subject;
}
