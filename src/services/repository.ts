import { getDB, type OutboxItem, type OutboxKind } from '../lib/db';
import type { ActiveRun, AnswerRecord, BookmarkRecord, Question, QuizSession, Scope, SessionMode, WrongRecord } from '../types';
import { GUEST_SCOPE } from '../types';
import { uuid } from '../utils';

/**
 * 本機資料層（IndexedDB）。訪客與會員都先寫入本機（離線優先），
 * 會員資料再透過 outbox 佇列同步到 Supabase（見 sync.ts）。
 */
const isMember = (scope: Scope) => scope !== GUEST_SCOPE;

async function enqueue(scope: Scope, kind: OutboxKind, payload: unknown) {
  if (!isMember(scope)) return;
  const db = await getDB();
  await db.add('outbox', { scope, kind, payload, createdAt: Date.now() });
}

// ───── sessions ─────
export async function listSessions(scope: Scope): Promise<QuizSession[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('sessions', 'scope', scope);
  return rows.map(({ scope: _s, ...s }) => s).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}
export async function getSession(scope: Scope, id: string): Promise<QuizSession | undefined> {
  const db = await getDB();
  const row = await db.get('sessions', [scope, id]);
  if (!row) return undefined;
  const { scope: _s, ...s } = row;
  return s;
}
/** 同一個 session id 只會寫入一次，避免重複提交。回傳 false 代表已存在。 */
export async function saveSession(scope: Scope, session: QuizSession): Promise<boolean> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'outbox'], 'readwrite');
  if (await tx.objectStore('sessions').get([scope, session.id])) {
    await tx.done;
    return false;
  }
  await tx.objectStore('sessions').put({ ...session, scope });
  if (isMember(scope)) await tx.objectStore('outbox').add({ scope, kind: 'session', payload: session, createdAt: Date.now() });
  await tx.done;
  return true;
}

// ───── bookmarks ─────
export async function listBookmarks(scope: Scope): Promise<BookmarkRecord[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('bookmarks', 'scope', scope);
  return rows.map(({ scope: _s, ...b }) => b).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function toggleBookmark(scope: Scope, q: Question): Promise<boolean> {
  const db = await getDB();
  const key: [string, string] = [scope, q.id];
  if (await db.get('bookmarks', key)) {
    await db.delete('bookmarks', key);
    await enqueue(scope, 'bookmark_del', { questionId: q.id });
    return false;
  }
  const rec: BookmarkRecord = { questionId: q.id, level: q.level, subject: q.subject, type: q.type, createdAt: new Date().toISOString() };
  await db.put('bookmarks', { ...rec, scope });
  await enqueue(scope, 'bookmark_put', rec);
  return true;
}

// ───── wrong questions ─────
export async function listWrongs(scope: Scope): Promise<WrongRecord[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('wrongs', 'scope', scope);
  return rows.map(({ scope: _s, ...w }) => w).sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt));
}
/** 同一題重複答錯只會更新次數與時間，不會產生重複資料。 */
export async function recordWrong(scope: Scope, q: Question, selectedIndex: number | null) {
  const db = await getDB();
  const key: [string, string] = [scope, q.id];
  const prev = await db.get('wrongs', key);
  const rec: WrongRecord = {
    questionId: q.id,
    level: q.level,
    subject: q.subject,
    type: q.type,
    wrongCount: (prev?.wrongCount ?? 0) + 1,
    lastWrongAt: new Date().toISOString(),
    lastSelectedIndex: selectedIndex,
  };
  await db.put('wrongs', { ...rec, scope });
  await enqueue(scope, 'wrong_put', rec);
}
export async function removeWrong(scope: Scope, questionId: string) {
  const db = await getDB();
  await db.delete('wrongs', [scope, questionId]);
  await enqueue(scope, 'wrong_del', { questionId });
}

// ───── active run（重新整理後還原）─────
const runKey = (scope: Scope, mode: SessionMode) => `${scope}:${mode}`;
export async function getRun(scope: Scope, mode: SessionMode): Promise<ActiveRun | undefined> {
  const db = await getDB();
  return (await db.get('active', runKey(scope, mode)))?.run;
}
export async function putRun(scope: Scope, run: ActiveRun) {
  const db = await getDB();
  await db.put('active', { key: runKey(scope, run.mode), run });
}
export async function clearRun(scope: Scope, mode: SessionMode) {
  const db = await getDB();
  await db.delete('active', runKey(scope, mode));
}

// ───── outbox ─────
export async function listOutbox(scope: Scope): Promise<OutboxItem[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('outbox', 'scope', scope);
  return rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}
export async function removeOutbox(seq: number) {
  const db = await getDB();
  await db.delete('outbox', seq);
}
export async function countOutbox(scope: Scope): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('outbox', 'scope', scope);
}

// ───── 雲端拉取結果寫入本機 ─────
export async function replaceCloudState(scope: Scope, data: { bookmarks: BookmarkRecord[]; wrongs: WrongRecord[]; sessions: QuizSession[] }) {
  const db = await getDB();
  const tx = db.transaction(['bookmarks', 'wrongs', 'sessions'], 'readwrite');
  for (const s of ['bookmarks', 'wrongs'] as const) {
    const store = tx.objectStore(s);
    for (const k of await store.index('scope').getAllKeys(scope)) await store.delete(k as never);
  }
  for (const b of data.bookmarks) await tx.objectStore('bookmarks').put({ ...b, scope });
  for (const w of data.wrongs) await tx.objectStore('wrongs').put({ ...w, scope });
  for (const s of data.sessions) await tx.objectStore('sessions').put({ ...s, scope });
  await tx.done;
}

// ───── 訪客資料匯入 ─────
export interface GuestSummary {
  sessions: number;
  bookmarks: number;
  wrongs: number;
}
export async function guestSummary(): Promise<GuestSummary> {
  const db = await getDB();
  return {
    sessions: await db.countFromIndex('sessions', 'scope', GUEST_SCOPE),
    bookmarks: await db.countFromIndex('bookmarks', 'scope', GUEST_SCOPE),
    wrongs: await db.countFromIndex('wrongs', 'scope', GUEST_SCOPE),
  };
}

export async function clearGuestData() {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'bookmarks', 'wrongs', 'active'], 'readwrite');
  for (const s of ['sessions', 'bookmarks', 'wrongs'] as const) {
    const store = tx.objectStore(s);
    for (const k of await store.index('scope').getAllKeys(GUEST_SCOPE)) await store.delete(k as never);
  }
  await tx.objectStore('active').delete(runKey(GUEST_SCOPE, 'exam'));
  await tx.objectStore('active').delete(runKey(GUEST_SCOPE, 'practice'));
  await tx.done;
}

/** 將訪客資料複製到會員帳號（保留原訪客資料，直到呼叫者確認成功後再清除）。 */
export async function importGuestInto(scope: Scope): Promise<GuestSummary> {
  const db = await getDB();
  const [gs, gb, gw] = await Promise.all([
    db.getAllFromIndex('sessions', 'scope', GUEST_SCOPE),
    db.getAllFromIndex('bookmarks', 'scope', GUEST_SCOPE),
    db.getAllFromIndex('wrongs', 'scope', GUEST_SCOPE),
  ]);
  for (const row of gs) {
    const { scope: _s, ...s } = row;
    await saveSession(scope, { ...s, id: uuid() });
  }
  for (const row of gb) {
    const { scope: _s, ...b } = row;
    if (!(await db.get('bookmarks', [scope, b.questionId]))) {
      await db.put('bookmarks', { ...b, scope });
      await enqueue(scope, 'bookmark_put', b);
    }
  }
  for (const row of gw) {
    const { scope: _s, ...w } = row;
    const prev = await db.get('wrongs', [scope, w.questionId]);
    const merged: WrongRecord = prev
      ? { ...w, wrongCount: prev.wrongCount + w.wrongCount, lastWrongAt: prev.lastWrongAt > w.lastWrongAt ? prev.lastWrongAt : w.lastWrongAt }
      : w;
    await db.put('wrongs', { ...merged, scope });
    await enqueue(scope, 'wrong_put', merged);
  }
  return { sessions: gs.length, bookmarks: gb.length, wrongs: gw.length };
}

export function buildAnswerRecord(q: Question, selectedIndex: number | null, flagged?: boolean): AnswerRecord {
  return { questionId: q.id, selectedIndex, isCorrect: selectedIndex === q.answerIndex, subject: q.subject, type: q.type, flagged };
}
