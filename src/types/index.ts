// 統一管理所有型別。題庫、使用者資料與同步都共用這裡的定義。

/** 目前支援 N5 / N4；之後擴充 N3、N2、N1 時在此加入即可。 */
export type Level = 'N5' | 'N4';
export const LEVELS: Level[] = ['N5', 'N4'];
/** 預留（尚未提供題庫）的等級，僅供 UI 顯示「即將推出」。 */
export const UPCOMING_LEVELS = ['N3', 'N2', 'N1'] as const;

export type Subject = 'vocabulary' | 'grammar' | 'reading';
export const SUBJECTS: Subject[] = ['vocabulary', 'grammar', 'reading'];

export type QuestionType =
  // 文字・語彙
  | 'kanji_reading'
  | 'orthography'
  | 'contextual'
  | 'paraphrase'
  | 'usage'
  // 文法
  | 'grammar_form'
  | 'sentence_composition'
  | 'text_grammar'
  // 讀解
  | 'reading_short'
  | 'reading_life'
  | 'reading_notice'
  | 'reading_mid'
  | 'reading_info';

export type ReviewStatus = 'approved' | 'pending' | 'rejected';
export type QuestionSource = 'original' | 'ai' | 'community';
export type PassageGenre = 'essay' | 'life' | 'notice' | 'email' | 'info' | 'blank';

export interface VocabNote {
  word: string;
  reading: string;
  meaning: string;
}
export interface GrammarNote {
  pattern: string;
  meaning: string;
}

export interface Question {
  id: string;
  level: Level;
  subject: Subject;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  /** 題幹。`[[文字]]` 代表底線；`＿＿＿` 與 `★` 用於句子組合。 */
  stem: string;
  passageId?: string;
  options: string[];
  /** 0-based */
  answerIndex: number;
  explanationZh: string;
  noteJa?: string;
  vocab: VocabNote[];
  grammar: GrammarNote[];
  source: QuestionSource;
  status: ReviewStatus;
}

export interface Passage {
  id: string;
  level: Level;
  genre: PassageGenre;
  title?: string;
  body: string;
  source: QuestionSource;
  status: ReviewStatus;
}

export interface QuestionBank {
  questions: Question[];
  passages: Passage[];
}

// ───────── 測驗 ─────────

export type SessionMode = 'practice' | 'exam';
export type ExamKind = 'full' | 'vocab' | 'grammar_reading';
export type PracticeCount = 10 | 20 | 30 | 'all';

export interface PracticeConfig {
  level: Level;
  subject: Subject | 'all';
  /** 空陣列代表該科目的所有題型 */
  types: QuestionType[];
  count: PracticeCount;
  onlyWrong: boolean;
  onlyBookmarked: boolean;
  /** 指定題目 ID（例如「重新練習這次答錯的題目」） */
  ids?: string[];
}

export interface AnswerRecord {
  questionId: string;
  selectedIndex: number | null;
  isCorrect: boolean;
  subject: Subject;
  type: QuestionType;
  flagged?: boolean;
}

export interface QuizSession {
  id: string;
  mode: SessionMode;
  level: Level;
  subject: Subject | 'all';
  examKind?: ExamKind;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  durationSec: number;
  timeLimitSec?: number;
  total: number;
  correct: number;
  answers: AnswerRecord[];
  config?: PracticeConfig;
}

export interface ExamSectionState {
  id: string;
  name: string;
  minutes: number;
  /** questionIds 中的區間 [start, end) */
  start: number;
  end: number;
  startedAt?: number; // ms
  endedAt?: number; // ms
}

/** 進行中的測驗（存在 IndexedDB，重新整理後可還原）。 */
export interface ActiveRun {
  sessionId: string;
  mode: SessionMode;
  level: Level;
  subject: Subject | 'all';
  examKind?: ExamKind;
  questionIds: string[];
  answers: Record<string, number>;
  flagged: string[];
  index: number;
  startedAt: number; // ms
  // practice
  config?: PracticeConfig;
  elapsedMs: number;
  lastSeen: number;
  // exam
  sections?: ExamSectionState[];
  sectionIndex?: number;
  phase?: 'running' | 'break';
  sectionDeadline?: number; // ms（目前這一節的結束時間）
}

export interface WrongRecord {
  questionId: string;
  level: Level;
  subject: Subject;
  type: QuestionType;
  wrongCount: number;
  lastWrongAt: string;
  lastSelectedIndex: number | null;
}

export interface BookmarkRecord {
  questionId: string;
  level: Level;
  subject: Subject;
  type: QuestionType;
  createdAt: string;
}

// ───────── 使用者 ─────────

export interface UserPreferences {
  level?: Level;
  practiceCount?: PracticeCount;
}

export interface Profile {
  id: string;
  email: string;
  nickname: string;
  createdAt: string;
  preferences: UserPreferences;
}

/** 本機資料的所有者範圍：訪客 = 'guest'，會員 = Supabase user id */
export type Scope = string;
export const GUEST_SCOPE: Scope = 'guest';
