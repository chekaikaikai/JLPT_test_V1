import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QuestionReviewCard } from '../../components/QuestionReviewCard';
import { EmptyState, ProgressBar, Spinner } from '../../components/ui';
import { useBank } from '../../contexts/BankContext';
import { useUserData } from '../../contexts/UserDataContext';
import { EXAM_KIND_LABEL } from '../../data/blueprints';
import { SUBJECT_META } from '../../data/meta';
import { subjectBreakdown } from '../../services/selection';
import { formatDate, formatDuration, pct } from '../../utils';
import { usePracticeStart } from '../practice/usePracticeStart';

export default function ResultPage() {
  const { id } = useParams();
  const { sessions, loading } = useUserData();
  const { index } = useBank();
  const navigate = useNavigate();
  const { start, error } = usePracticeStart();
  const [onlyWrong, setOnlyWrong] = useState(false);

  const session = sessions.find((s) => s.id === id);
  const breakdown = useMemo(() => (session ? subjectBreakdown(session.answers) : []), [session]);

  if (loading) return <Spinner />;
  if (!session)
    return (
      <EmptyState title="找不到這筆測驗紀錄" action={<Link to="/" className="btn-primary">回到首頁</Link>}>
        紀錄可能已被移除，或屬於其他帳號。
      </EmptyState>
    );

  const rate = pct(session.correct, session.total);
  const wrongIds = session.answers.filter((a) => !a.isCorrect).map((a) => a.questionId);
  const shown = session.answers.filter((a) => (onlyWrong ? !a.isCorrect : true));
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-6">
      <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="#F1EADB" strokeWidth="9" />
            <circle cx="60" cy="60" r={R} fill="none" stroke="#C9402B" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - rate / 100)} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-4xl text-shu">{rate}<span className="text-lg">%</span></span>
            <span className="text-[11px] text-ink-faint">練習分數</span>
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl">{session.mode === 'exam' ? `${session.level} ${EXAM_KIND_LABEL[session.examKind ?? 'full']}` : `${session.level} 練習`}　成績</h1>
          <p className="mt-1 text-xs text-ink-faint">{formatDate(session.finishedAt, true)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-ink-faint">答對</dt><dd className="font-serif text-2xl text-ok">{session.correct}</dd></div>
            <div><dt className="text-ink-faint">答錯</dt><dd className="font-serif text-2xl text-ng">{session.total - session.correct}</dd></div>
            <div><dt className="text-ink-faint">題數</dt><dd className="font-serif text-2xl">{session.total}</dd></div>
            <div><dt className="text-ink-faint">花費時間</dt><dd className="font-serif text-2xl">{formatDuration(session.durationSec)}</dd></div>
          </dl>
        </div>
      </div>

      <p className="rounded-xl bg-sand px-4 py-3 text-xs leading-6 text-ink-soft">
        這是本站計算的「練習測驗分數」（答對題數 ÷ 總題數），並非 JLPT 官方的等化分數，也不能用來判定是否合格。
      </p>

      {breakdown.length > 0 && (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg">各科目正確率</h2>
          {breakdown.map((b) => (
            <div key={b.subject}>
              <div className="mb-1 flex justify-between text-sm"><span>{SUBJECT_META[b.subject].label}</span><span className="text-ink-soft">{b.correct} / {b.total}（{pct(b.correct, b.total)}%）</span></div>
              <ProgressBar value={pct(b.correct, b.total)} tone="ok" />
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          onClick={() => (session.mode === 'exam' ? navigate('/exam') : session.config ? void start({ ...session.config, ids: undefined }) : navigate('/practice'))}
        >
          再考一次
        </button>
        <button className="btn-secondary" disabled={wrongIds.length === 0} onClick={() => void start({ level: session.level, subject: 'all', types: [], count: 'all', onlyWrong: false, onlyBookmarked: false, ids: wrongIds })}>
          錯題重新練習（{wrongIds.length}）
        </button>
        <Link to="/" className="btn-ghost">返回 Dashboard</Link>
      </div>
      {error && <p className="text-sm text-ng">{error}</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">各題作答結果與解析</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-shu" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /> 只看答錯</label>
        </div>
        {shown.map((a) => {
          const q = index.byId.get(a.questionId);
          const n = session.answers.indexOf(a) + 1;
          if (!q) return <div key={a.questionId} className="card p-4 text-sm text-ink-faint">第 {n} 題：此題目已不在題庫中。</div>;
          return (
            <QuestionReviewCard
              key={a.questionId}
              question={q}
              selected={a.selectedIndex}
              status={a.selectedIndex === null ? 'none' : a.isCorrect ? 'right' : 'wrong'}
              meta={<span>第 {n} 題{a.selectedIndex === null ? '・未作答' : ''}</span>}
            />
          );
        })}
      </section>
    </div>
  );
}
