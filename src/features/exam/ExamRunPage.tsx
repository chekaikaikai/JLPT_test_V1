import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Clock, Flag, Grid3x3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { QuestionView } from '../../components/QuestionView';
import { Modal, ProgressBar, Spinner } from '../../components/ui';
import { useBank } from '../../contexts/BankContext';
import { useUserData } from '../../contexts/UserDataContext';
import { useActiveRun, useFinalize } from '../../hooks/useActiveRun';
import { endSection, startSection } from '../../services/runs';
import { formatClock } from '../../utils';

export default function ExamRunPage() {
  const { run, update } = useActiveRun('exam');
  const { index } = useBank();
  const { bookmarkIds, toggleBookmark } = useUserData();
  const finalize = useFinalize();
  const [now, setNow] = useState(Date.now());
  const [palette, setPalette] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const sIdx = run?.sectionIndex ?? 0;
  const section = run?.sections?.[sIdx];
  const remaining = run?.phase === 'running' && run.sectionDeadline ? run.sectionDeadline - now : Infinity;

  // 時間到：自動結束本節（最後一節＝自動交卷）。重新整理後若已超時也會立即處理。
  useEffect(() => {
    if (!run || run.phase !== 'running' || remaining > 0) return;
    const { run: next, done } = endSection(run);
    if (done) void finalize(next);
    else update(() => next);
  }, [run, remaining, finalize, update]);

  if (run === undefined) return <Spinner />;
  if (run === null || !section) return <Navigate to="/exam" replace />;

  const isLastSection = sIdx >= run.sections!.length - 1;

  // ── 節與節之間的休息畫面 ──
  if (run.phase === 'break') {
    const next = run.sections![sIdx + 1];
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="seal mx-auto mb-5 h-20 w-20 font-serif text-3xl">済</div>
        <h1 className="text-2xl">「{section.name}」已結束</h1>
        <p className="mt-3 text-sm text-ink-soft">下一節：{next.name}（{next.minutes} 分鐘）。<br />準備好之後按下開始才會計時，且無法回到前一節。</p>
        <button className="btn-primary mt-8 px-8" onClick={() => update((r) => startSection(r, sIdx + 1))}>開始下一節</button>
      </div>
    );
  }

  const ids = run.questionIds.slice(section.start, section.end).filter((id) => index.byId.has(id));
  const pos = Math.max(0, Math.min(ids.length - 1, run.index - section.start));
  const q = index.byId.get(ids[pos]);
  if (!q) return <Navigate to="/exam" replace />;
  const passage = q.passageId ? index.passageById.get(q.passageId) : undefined;
  const answeredCount = ids.filter((id) => run.answers[id] !== undefined).length;
  const flaggedCount = ids.filter((id) => run.flagged.includes(id)).length;
  const go = (p: number) => update((r) => ({ ...r, index: section.start + Math.max(0, Math.min(ids.length - 1, p)) }));
  const low = remaining < 5 * 60_000;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="sticky top-[88px] z-20 -mx-4 space-y-2 border-b border-line bg-paper/95 px-4 pb-3 pt-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="min-w-0">
            <div className="truncate text-xs text-ink-faint">{run.level}・{section.name}</div>
            <div className="text-ink-soft">第 <b className="text-ink">{pos + 1}</b> / {ids.length} 題　已作答 {answeredCount}</div>
          </div>
          <div className={clsx('flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-lg tabular-nums', low ? 'bg-shu text-white' : 'bg-sand text-ink')} role="timer" aria-label="剩餘時間">
            <Clock className="h-4 w-4" /> {formatClock(remaining)}
          </div>
        </div>
        <ProgressBar value={(answeredCount / ids.length) * 100} />
      </div>

      <div className="card p-5 sm:p-7">
        <QuestionView
          question={q}
          passage={passage}
          number={pos + 1}
          selected={run.answers[q.id]}
          onSelect={(o) => update((r) => ({ ...r, answers: { ...r.answers, [q.id]: o } }))}
          flagged={run.flagged.includes(q.id)}
          onToggleFlag={() => update((r) => ({ ...r, flagged: r.flagged.includes(q.id) ? r.flagged.filter((x) => x !== q.id) : [...r.flagged, q.id] }))}
          bookmarked={bookmarkIds.has(q.id)}
          onToggleBookmark={() => void toggleBookmark(q)}
        />
        {run.answers[q.id] !== undefined && (
          <button className="btn-ghost btn-sm mt-3" onClick={() => update((r) => { const a = { ...r.answers }; delete a[q.id]; return { ...r, answers: a }; })}>清除我的答案（暫時保留未作答）</button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button className="btn-secondary" disabled={pos === 0} onClick={() => go(pos - 1)}><ArrowLeft className="h-4 w-4" /> 上一題</button>
        <button className="btn-ghost" onClick={() => setPalette(true)}><Grid3x3 className="h-4 w-4" /> 跳轉題號</button>
        {pos < ids.length - 1 ? (
          <button className="btn-primary" onClick={() => go(pos + 1)}>下一題 <ArrowRight className="h-4 w-4" /></button>
        ) : (
          <button className="btn-primary" onClick={() => setConfirm(true)}><Flag className="h-4 w-4" /> {isLastSection ? '交卷' : '結束本節'}</button>
        )}
      </div>
      <div className="text-center">
        <button className="text-xs text-ink-faint underline" onClick={() => setConfirm(true)}>{isLastSection ? '提前交卷' : '提前結束本節'}</button>
      </div>

      <Modal open={palette} onClose={() => setPalette(false)} title="題目一覽" footer={<button className="btn-primary" onClick={() => setPalette(false)}>關閉</button>}>
        <div className="mb-3 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1"><i className="h-3 w-3 rounded bg-shu-soft ring-1 ring-shu" /> 已作答</span>
          <span className="inline-flex items-center gap-1"><i className="h-3 w-3 rounded bg-card ring-1 ring-line" /> 未作答</span>
          <span className="inline-flex items-center gap-1"><Flag className="h-3 w-3 text-shu" /> 待確認</span>
        </div>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {ids.map((id, n) => (
            <button key={id} onClick={() => { go(n); setPalette(false); }} className={clsx('relative h-10 rounded-lg border text-sm', n === pos && 'ring-2 ring-shu', run.answers[id] !== undefined ? 'border-shu bg-shu-soft' : 'border-line bg-card')}>
              {n + 1}
              {run.flagged.includes(id) && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-shu text-shu" />}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={isLastSection ? '確定要交卷嗎？' : '確定要結束本節嗎？'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirm(false)}>回去檢查</button>
            <button
              className="btn-primary"
              onClick={() => {
                setConfirm(false);
                const { run: next, done } = endSection(run);
                if (done) void finalize(next);
                else update(() => next);
              }}
            >
              {isLastSection ? '確認交卷' : '結束本節'}
            </button>
          </>
        }
      >
        <ul className="space-y-1">
          <li>已作答：{answeredCount} / {ids.length} 題</li>
          <li className={ids.length - answeredCount > 0 ? 'text-ng' : ''}>未作答：{ids.length - answeredCount} 題</li>
          <li>標記待確認：{flaggedCount} 題</li>
        </ul>
        <p className="mt-3 text-xs">{isLastSection ? '交卷後無法再修改答案。' : '結束後會進入下一節，且無法回到本節。'}</p>
      </Modal>
    </div>
  );
}
