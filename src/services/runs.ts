import type { ActiveRun, ExamKind, ExamSectionState, Level, PracticeConfig, Question, QuizSession } from '../types';
import { uuid } from '../utils';
import { buildAnswerRecord } from './repository';
import type { BankIndex } from './selection';

export function createPracticeRun(config: PracticeConfig, questions: Question[]): ActiveRun {
  const now = Date.now();
  return {
    sessionId: uuid(),
    mode: 'practice',
    level: config.level,
    subject: config.subject,
    questionIds: questions.map((q) => q.id),
    answers: {},
    flagged: [],
    index: 0,
    startedAt: now,
    config,
    elapsedMs: 0,
    lastSeen: now,
  };
}

export function createExamRun(level: Level, kind: ExamKind, questionIds: string[], sections: ExamSectionState[]): ActiveRun {
  const now = Date.now();
  const first = { ...sections[0], startedAt: now };
  return {
    sessionId: uuid(),
    mode: 'exam',
    level,
    subject: 'all',
    examKind: kind,
    questionIds,
    answers: {},
    flagged: [],
    index: first.start,
    startedAt: now,
    elapsedMs: 0,
    lastSeen: now,
    sections: [first, ...sections.slice(1)],
    sectionIndex: 0,
    phase: 'running',
    sectionDeadline: now + first.minutes * 60_000,
  };
}

/** 練習時只累計「有操作」的時間：兩次操作間隔最多算 60 秒。 */
export function advancePractice(run: ActiveRun, now = Date.now()): ActiveRun {
  return { ...run, elapsedMs: run.elapsedMs + Math.min(Math.max(now - run.lastSeen, 0), 60_000), lastSeen: now };
}

/** 進入下一節（或結束 break 後開始計時）。 */
export function startSection(run: ActiveRun, idx: number, now = Date.now()): ActiveRun {
  const sections = run.sections!.map((s, i) => (i === idx ? { ...s, startedAt: now } : s));
  return { ...run, sections, sectionIndex: idx, phase: 'running', index: sections[idx].start, sectionDeadline: now + sections[idx].minutes * 60_000 };
}

/** 結束目前這一節，回傳新狀態；若已是最後一節則 done = true。 */
export function endSection(run: ActiveRun, now = Date.now()): { run: ActiveRun; done: boolean } {
  const i = run.sectionIndex ?? 0;
  const sections = run.sections!.map((s, k) => (k === i ? { ...s, endedAt: now } : s));
  const done = i >= sections.length - 1;
  return { run: { ...run, sections, phase: done ? run.phase : 'break' }, done };
}

export function buildSession(run: ActiveRun, bank: BankIndex, now = Date.now()): QuizSession | null {
  const questions = run.questionIds.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q);
  const isExam = run.mode === 'exam';
  const answered = questions.filter((q) => run.answers[q.id] !== undefined);
  const target = isExam ? questions : answered;
  if (target.length === 0) return null;
  const answers = target.map((q) => buildAnswerRecord(q, run.answers[q.id] ?? null, run.flagged.includes(q.id) || undefined));

  let durationSec: number;
  let timeLimitSec: number | undefined;
  if (isExam) {
    durationSec = Math.round(run.sections!.reduce((n, s) => (s.startedAt ? n + ((s.endedAt ?? now) - s.startedAt) : n), 0) / 1000);
    timeLimitSec = run.sections!.reduce((n, s) => n + s.minutes * 60, 0);
  } else {
    durationSec = Math.round(advancePractice(run, now).elapsedMs / 1000);
  }
  return {
    id: run.sessionId,
    mode: run.mode,
    level: run.level,
    subject: run.subject,
    examKind: run.examKind,
    startedAt: new Date(run.startedAt).toISOString(),
    finishedAt: new Date(now).toISOString(),
    durationSec,
    timeLimitSec,
    total: answers.length,
    correct: answers.filter((a) => a.isCorrect).length,
    answers,
    config: run.config,
  };
}
