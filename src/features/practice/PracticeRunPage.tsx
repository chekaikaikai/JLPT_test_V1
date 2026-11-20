import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Flag, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Explanation } from '../../components/Explanation';
import { QuestionView } from '../../components/QuestionView';
import { Modal, ProgressBar, Spinner } from '../../components/ui';
import { useBank } from '../../contexts/BankContext';
import { useUserData } from '../../contexts/UserDataContext';
import { useActiveRun, useFinalize } from '../../hooks/useActiveRun';
import { advancePractice } from '../../services/runs';

export default function PracticeRunPage() {
  const { run, update, clear } = useActiveRun('practice');
  const { index } = useBank();
  const { bookmarkIds, toggleBookmark, recordWrong } = useUserData();
  const finalize = useFinalize();
  const navigate = useNavigate();
  const [grid, setGrid] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (run === undefined) return <Spinner />;
  if (run === null) return <Navigate to="/practice" replace />;

  const ids = run.questionIds.filter((id) => index.byId.has(id));
  const total = ids.length;
  const q = index.byId.get(ids[Math.min(run.index, total - 1)]);
  if (!q || total === 0) return <Navigate to="/practice" replace />;
  const i = Math.min(run.index, total - 1);
  const selected = run.answers[q.id];
  const answered = selected !== undefined;
  const answeredCount = ids.filter((id) => run.answers[id] !== undefined).length;
  const passage = q.passageId ? index.passageById.get(q.passageId) : undefined;
  const go = (n: number) => update((r) => advancePractice({ ...r, index: Math.max(0, Math.min(total - 1, n)) }));

  const choose = (opt: number) => {
    if (answered) return;
    update((r) => advancePractice({ ...r, answers: { ...r.answers, [q.id]: opt } }));
    if (opt !== q.answerIndex) void recordWrong(q, opt);
  };

  const isLast = i === total - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>第 <b className="text-ink">{i + 1}</b> / {total} 題　已作答 {answeredCount}</span>
          <div className="flex gap-1">
            <button className="btn-ghost btn-sm" onClick={() => setGrid(true)}><ListChecks className="h-4 w-4" /> 題目列表</button>
            <button className="btn-secondary btn-sm" onClick={() => setConfirmEnd(true)}><Flag className="h-4 w-4" /> 結束</button>
          </div>
        </div>
        <ProgressBar value={(answeredCount / total) * 100} />
      </div>

      <div className="card space-y-5 p-5 sm:p-7">
        <QuestionView
          question={q}
          passage={passage}
          number={i + 1}
          selected={selected}
          reveal={answered}
          disabled={answered}
          onSelect={choose}
          bookmarked={bookmarkIds.has(q.id)}
          onToggleBookmark={() => void toggleBookmark(q)}
        />
        {answered && <Explanation question={q} selected={selected} />}
      </div>

      <div className="flex items-center justify-between">
        <button className="btn-secondary" disabled={i === 0} onClick={() => go(i - 1)}><ArrowLeft className="h-4 w-4" /> 上一題</button>
        {isLast ? (
          <button className="btn-primary" onClick={() => (answeredCount === total ? void finalize(run) : setConfirmEnd(true))}>完成練習</button>
        ) : (
          <button className="btn-primary" onClick={() => go(i + 1)}>{answered ? '下一題' : '跳過'} <ArrowRight className="h-4 w-4" /></button>
        )}
      </div>

      <Modal open={grid} onClose={() => setGrid(false)} title="題目列表" footer={<button className="btn-primary" onClick={() => setGrid(false)}>關閉</button>}>
        <p className="mb-3 text-xs">點選題號可回顧已作答的題目。綠色＝答對、紅色＝答錯。</p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {ids.map((id, n) => {
            const a = run.answers[id];
            const ok = a !== undefined && a === index.byId.get(id)!.answerIndex;
            return (
              <button key={id} onClick={() => { go(n); setGrid(false); }} className={clsx('h-10 rounded-lg border text-sm', n === i && 'ring-2 ring-shu', a === undefined ? 'border-line bg-card' : ok ? 'border-ok bg-ok-soft text-ok' : 'border-ng bg-ng-soft text-ng')}>
                {n + 1}
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="結束練習？"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmEnd(false)}>繼續作答</button>
            <button className="btn-ghost text-ng" onClick={async () => { await clear(); navigate('/practice'); }}>放棄（不記錄）</button>
            <button className="btn-primary" onClick={() => void finalize(run)}>結束並查看成績</button>
          </>
        }
      >
        你已作答 {answeredCount} / {total} 題。結束後只會計算已作答的題目。
      </Modal>
    </div>
  );
}
