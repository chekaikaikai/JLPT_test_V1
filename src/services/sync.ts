import { supabase } from '../lib/supabase';
import type { AnswerRecord, BookmarkRecord, Question, QuizSession, WrongRecord } from '../types';
import { listOutbox, removeOutbox, replaceCloudState } from './repository';

function requireClient() {
  if (!supabase) throw new Error('尚未設定 Supabase');
  return supabase;
}

/** 依序把本機待同步的操作送到 Supabase。任何一筆失敗就停止（保留在佇列，下次重試），資料不會遺失。 */
export async function flushOutbox(userId: string): Promise<number> {
  const sb = requireClient();
  const items = await listOutbox(userId);
  let done = 0;
  for (const item of items) {
    let error: { message: string } | null = null;
    switch (item.kind) {
      case 'session': {
        const s = item.payload as QuizSession;
        ({ error } = await sb.from('quiz_sessions').upsert(
          {
            id: s.id,
            user_id: userId,
            mode: s.mode,
            level: s.level,
            subject: s.subject,
            exam_kind: s.examKind ?? null,
            started_at: s.startedAt,
            finished_at: s.finishedAt,
            duration_sec: s.durationSec,
            time_limit_sec: s.timeLimitSec ?? null,
            total: s.total,
            correct: s.correct,
            config: s.config ?? null,
          },
          { onConflict: 'id' },
        ));
        if (!error && s.answers.length > 0) {
          ({ error } = await sb.from('quiz_answers').upsert(
            s.answers.map((a, i) => ({
              session_id: s.id,
              user_id: userId,
              question_id: a.questionId,
              position: i,
              selected_index: a.selectedIndex,
              is_correct: a.isCorrect,
              subject: a.subject,
              qtype: a.type,
              flagged: a.flagged ?? false,
            })),
            { onConflict: 'session_id,question_id' },
          ));
        }
        break;
      }
      case 'bookmark_put': {
        const b = item.payload as BookmarkRecord;
        ({ error } = await sb.from('bookmarks').upsert(
          { user_id: userId, question_id: b.questionId, level: b.level, subject: b.subject, qtype: b.type, created_at: b.createdAt },
          { onConflict: 'user_id,question_id' },
        ));
        break;
      }
      case 'bookmark_del': {
        const { questionId } = item.payload as { questionId: string };
        ({ error } = await sb.from('bookmarks').delete().eq('user_id', userId).eq('question_id', questionId));
        break;
      }
      case 'wrong_put': {
        const w = item.payload as WrongRecord;
        ({ error } = await sb.from('wrong_questions').upsert(
          {
            user_id: userId,
            question_id: w.questionId,
            level: w.level,
            subject: w.subject,
            qtype: w.type,
            wrong_count: w.wrongCount,
            last_wrong_at: w.lastWrongAt,
            last_selected_index: w.lastSelectedIndex,
          },
          { onConflict: 'user_id,question_id' },
        ));
        break;
      }
      case 'wrong_del': {
        const { questionId } = item.payload as { questionId: string };
        ({ error } = await sb.from('wrong_questions').delete().eq('user_id', userId).eq('question_id', questionId));
        break;
      }
    }
    if (error) throw new Error(error.message);
    await removeOutbox(item.seq!);
    done += 1;
  }
  return done;
}

/** 從雲端拉取該會員的資料並寫入本機（需在 flush 成功後呼叫，避免覆蓋尚未上傳的變更）。 */
export async function pullAll(userId: string): Promise<void> {
  const sb = requireClient();
  const [b, w, s] = await Promise.all([
    sb.from('bookmarks').select('*').eq('user_id', userId),
    sb.from('wrong_questions').select('*').eq('user_id', userId),
    sb.from('quiz_sessions').select('*, quiz_answers(*)').eq('user_id', userId).order('finished_at', { ascending: false }).limit(300),
  ]);
  const err = b.error ?? w.error ?? s.error;
  if (err) throw new Error(err.message);

  const bookmarks: BookmarkRecord[] = (b.data ?? []).map((r) => ({
    questionId: r.question_id,
    level: r.level,
    subject: r.subject,
    type: r.qtype,
    createdAt: r.created_at,
  }));
  const wrongs: WrongRecord[] = (w.data ?? []).map((r) => ({
    questionId: r.question_id,
    level: r.level,
    subject: r.subject,
    type: r.qtype,
    wrongCount: r.wrong_count,
    lastWrongAt: r.last_wrong_at,
    lastSelectedIndex: r.last_selected_index,
  }));
  const sessions: QuizSession[] = (s.data ?? []).map((r) => {
    const answers: AnswerRecord[] = [...(r.quiz_answers ?? [])]
      .sort((x: { position: number }, y: { position: number }) => x.position - y.position)
      .map((a: { question_id: string; selected_index: number | null; is_correct: boolean; subject: AnswerRecord['subject']; qtype: AnswerRecord['type']; flagged: boolean }) => ({
        questionId: a.question_id,
        selectedIndex: a.selected_index,
        isCorrect: a.is_correct,
        subject: a.subject,
        type: a.qtype,
        flagged: a.flagged,
      }));
    return {
      id: r.id,
      mode: r.mode,
      level: r.level,
      subject: r.subject,
      examKind: r.exam_kind ?? undefined,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      durationSec: r.duration_sec,
      timeLimitSec: r.time_limit_sec ?? undefined,
      total: r.total,
      correct: r.correct,
      answers,
      config: r.config ?? undefined,
    };
  });
  await replaceCloudState(userId, { bookmarks, wrongs, sessions });
}

export async function syncAll(userId: string): Promise<void> {
  await flushOutbox(userId);
  await pullAll(userId);
}

// ───── 雲端題庫（只取已審核）─────
export async function fetchApprovedBank(): Promise<{ questions: Question[]; passages: import('../types').Passage[] }> {
  const sb = requireClient();
  const page = 1000;
  const questions: Question[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from('questions').select('*').eq('status', 'approved').range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? [])
      questions.push({
        id: r.id,
        level: r.level,
        subject: r.subject,
        type: r.qtype,
        difficulty: r.difficulty,
        stem: r.stem,
        passageId: r.passage_id ?? undefined,
        options: r.options,
        answerIndex: r.answer_index,
        explanationZh: r.explanation_zh,
        noteJa: r.note_ja ?? undefined,
        vocab: r.vocab ?? [],
        grammar: r.grammar ?? [],
        source: r.source,
        status: r.status,
      });
    if (!data || data.length < page) break;
  }
  const passages: import('../types').Passage[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from('reading_passages').select('*').eq('status', 'approved').range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? [])
      passages.push({ id: r.id, level: r.level, genre: r.genre, title: r.title ?? undefined, body: r.body, source: r.source, status: r.status });
    if (!data || data.length < page) break;
  }
  return { questions, passages };
}
