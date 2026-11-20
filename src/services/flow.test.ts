import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_BANK } from '../data/bank';
import { clearGuestData, countOutbox, guestSummary, importGuestInto, listBookmarks, listOutbox, listSessions, listWrongs, recordWrong, saveSession, toggleBookmark } from './repository';
import { buildSession, createExamRun, createPracticeRun, endSection, startSection } from './runs';
import { buildExam, buildPractice, indexBank } from './selection';
import { getDB } from '../lib/db';
import { GUEST_SCOPE } from '../types';

const idx = indexBank(BUILTIN_BANK.questions, BUILTIN_BANK.passages);
const USER = '11111111-1111-1111-1111-111111111111';

beforeEach(async () => {
  const db = await getDB();
  for (const s of ['sessions', 'bookmarks', 'wrongs', 'outbox', 'active'] as const) await db.clear(s);
});

describe('模擬考完整流程', () => {
  it('兩節計時、交卷、計分正確，未作答視為答錯', () => {
    const built = buildExam(idx, 'N5', 'full');
    if (!built.ok) throw new Error('應可組成考卷');
    let run = createExamRun('N5', 'full', built.questionIds, built.sections);
    expect(run.sections).toHaveLength(2);
    expect(run.sectionDeadline! - run.startedAt).toBe(20 * 60_000);

    // 第一節：全部答對
    for (const id of built.questionIds.slice(run.sections![0].start, run.sections![0].end)) run.answers[id] = idx.byId.get(id)!.answerIndex;
    let r = endSection(run, run.startedAt + 600_000);
    expect(r.done).toBe(false);
    expect(r.run.phase).toBe('break');

    // 第二節：開始後 40 分鐘
    run = startSection(r.run, 1, run.startedAt + 700_000);
    expect(run.sectionDeadline! - run.sections![1].startedAt!).toBe(40 * 60_000);
    r = endSection(run, run.sections![1].startedAt! + 1_200_000);
    expect(r.done).toBe(true);

    const s = buildSession(r.run, idx, run.sections![1].startedAt! + 1_200_000)!;
    expect(s.total).toBe(43);
    expect(s.correct).toBe(21); // 只有第一節 21 題答對
    expect(s.answers.filter((a) => a.selectedIndex === null)).toHaveLength(22);
    expect(s.durationSec).toBe(600 + 1200);
  });
});

describe('本機資料層', () => {
  it('同一 session 重複提交只會保存一次', async () => {
    const q = idx.questions[0];
    const run = createPracticeRun({ level: q.level, subject: 'all', types: [], count: 10, onlyWrong: false, onlyBookmarked: false }, [q]);
    run.answers[q.id] = q.answerIndex;
    const s = buildSession(run, idx)!;
    expect(await saveSession(USER, s)).toBe(true);
    expect(await saveSession(USER, s)).toBe(false);
    expect(await listSessions(USER)).toHaveLength(1);
    expect(await countOutbox(USER)).toBe(1);
  });

  it('同一題重複答錯只更新次數，不產生重複資料', async () => {
    const q = idx.questions[3];
    await recordWrong(GUEST_SCOPE, q, 0);
    await recordWrong(GUEST_SCOPE, q, 1);
    const w = await listWrongs(GUEST_SCOPE);
    expect(w).toHaveLength(1);
    expect(w[0].wrongCount).toBe(2);
    expect(w[0].lastSelectedIndex).toBe(1);
  });

  it('訪客資料不進同步佇列；會員資料進佇列；資料依範圍隔離', async () => {
    const q = idx.questions[0];
    await toggleBookmark(GUEST_SCOPE, q);
    await toggleBookmark(USER, q);
    expect(await listBookmarks(GUEST_SCOPE)).toHaveLength(1);
    expect(await listBookmarks(USER)).toHaveLength(1);
    expect(await countOutbox(GUEST_SCOPE)).toBe(0);
    expect((await listOutbox(USER)).map((i) => i.kind)).toEqual(['bookmark_put']);
    expect(await toggleBookmark(USER, q)).toBe(false);
    expect(await listBookmarks(USER)).toHaveLength(0);
  });

  it('訪客資料可匯入會員帳號並清除', async () => {
    const [a, b] = idx.questions;
    await toggleBookmark(GUEST_SCOPE, a);
    await recordWrong(GUEST_SCOPE, b, 2);
    const run = createPracticeRun({ level: a.level, subject: 'all', types: [], count: 10, onlyWrong: false, onlyBookmarked: false }, [a]);
    run.answers[a.id] = 0;
    await saveSession(GUEST_SCOPE, buildSession(run, idx)!);
    expect(await guestSummary()).toEqual({ sessions: 1, bookmarks: 1, wrongs: 1 });

    await importGuestInto(USER);
    await clearGuestData();
    expect(await guestSummary()).toEqual({ sessions: 0, bookmarks: 0, wrongs: 0 });
    expect(await listSessions(USER)).toHaveLength(1);
    expect(await listBookmarks(USER)).toHaveLength(1);
    expect(await listWrongs(USER)).toHaveLength(1);
    expect((await listOutbox(USER)).map((i) => i.kind).sort()).toEqual(['bookmark_put', 'session', 'wrong_put']);
  });
});

describe('練習篩選', () => {
  it('只練習錯題 / 收藏 / 指定 ID', () => {
    const [a, b, c] = idx.questions.filter((q) => q.level === 'N5' && !q.passageId);
    const base = { level: 'N5' as const, subject: 'all' as const, types: [], count: 'all' as const };
    expect(buildPractice(idx, { ...base, onlyWrong: true, onlyBookmarked: false }, new Set([a.id]), new Set()).questions.map((q) => q.id)).toEqual([a.id]);
    expect(buildPractice(idx, { ...base, onlyWrong: false, onlyBookmarked: true }, new Set(), new Set([b.id])).questions.map((q) => q.id)).toEqual([b.id]);
    expect(buildPractice(idx, { ...base, onlyWrong: false, onlyBookmarked: false, ids: [c.id] }, new Set(), new Set()).questions.map((q) => q.id)).toEqual([c.id]);
  });
});
