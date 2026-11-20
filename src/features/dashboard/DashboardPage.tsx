import { ArrowRight, BookX, Bookmark, GraduationCap, PenLine, Target, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LevelSwitcher } from '../../components/LevelSwitcher';
import { ProgressBar, Spinner } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useBank } from '../../contexts/BankContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { useUserData } from '../../contexts/UserDataContext';
import { EXAM_KIND_LABEL } from '../../data/blueprints';
import { SUBJECT_META } from '../../data/meta';
import { overall, subjectProgress } from '../../services/stats';
import { formatDate, pct } from '../../utils';
import { usePracticeStart } from '../practice/usePracticeStart';

export default function DashboardPage() {
  const { profile, userId } = useAuth();
  const { level } = usePrefs();
  const { index } = useBank();
  const { sessions, wrongs, bookmarks, loading, isGuest } = useUserData();
  const { start, error } = usePracticeStart();

  if (loading) return <Spinner />;
  const mine = sessions.filter((s) => s.level === level);
  const all = overall(sessions);
  const last = sessions[0];
  const progress = subjectProgress(sessions, level, index);
  const wrongCount = wrongs.filter((w) => w.level === level).length;
  const bookmarkCount = bookmarks.filter((b) => b.level === level).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-faint">{userId ? 'おかえりなさい' : 'ようこそ'}</p>
          <h1 className="text-3xl sm:text-4xl">{userId ? `${profile?.nickname ?? '學習者'}，今天也一起加油` : '歡迎，一起準備 JLPT'}</h1>
        </div>
        <LevelSwitcher showUpcoming />
      </section>

      {isGuest && (
        <div className="card flex flex-wrap items-center gap-3 border-dashed p-4 text-sm text-ink-soft">
          <span>訪客模式：學習紀錄只儲存在這台裝置。登入後可跨裝置同步，並可匯入目前的紀錄。</span>
          <Link to="/login" className="btn-secondary btn-sm ml-auto">登入 / 註冊</Link>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<Target className="h-4 w-4" />} label="累積練習題數" value={`${all.total}`} unit="題" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="整體正確率" value={all.total ? `${all.accuracy}` : '—'} unit={all.total ? '%' : ''} />
        <Stat
          icon={<GraduationCap className="h-4 w-4" />}
          label="最近一次測驗"
          value={last ? `${pct(last.correct, last.total)}` : '—'}
          unit={last ? '%' : ''}
          sub={last ? `${last.level}・${last.mode === 'exam' ? EXAM_KIND_LABEL[last.examKind ?? 'full'] : '練習'}・${formatDate(last.finishedAt)}` : '還沒有測驗紀錄'}
          to={last ? `/result/${last.id}` : undefined}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button className="card group flex items-center gap-3 p-4 text-left transition hover:shadow-lift" onClick={() => void start({ level, subject: 'all', types: [], count: 10, onlyWrong: false, onlyBookmarked: false })}>
          <span className="rounded-full bg-shu p-2.5 text-white"><Zap className="h-5 w-5" /></span>
          <span><b className="block">快速練習</b><span className="text-xs text-ink-faint">{level}・10 題綜合</span></span>
        </button>
        <Action to="/practice" icon={<PenLine className="h-5 w-5" />} title="自訂練習" sub="選科目、題型、題數" />
        <Action to="/exam" icon={<GraduationCap className="h-5 w-5" />} title="開始模擬考" sub={`${level} 官方規格`} />
        <Action to="/wrong" icon={<BookX className="h-5 w-5" />} title="錯題本" sub={`${wrongCount} 題待複習`} />
      </section>
      {error && <p className="text-sm text-ng">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card space-y-5 p-5 lg:col-span-3">
          <h2 className="text-lg">{level} 各科目學習進度</h2>
          {progress.map((p) => (
            <div key={p.subject}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">{SUBJECT_META[p.subject].label}</span>
                <span className="text-xs text-ink-faint">已接觸 {p.done} / {p.bankTotal} 題・正確率 {p.answered ? `${p.accuracy}%` : '—'}</span>
              </div>
              <ProgressBar value={p.coverage} />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 text-xs text-ink-faint">
            <Bookmark className="h-3.5 w-3.5" /> 收藏 {bookmarkCount} 題　<Link to="/bookmarks" className="underline">查看</Link>
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">最近測驗</h2>
            <Link to="/history" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-shu">全部 <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {mine.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">{level} 還沒有紀錄，來做第一份練習吧。</p>
          ) : (
            <ul className="divide-y divide-line">
              {mine.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link to={`/result/${s.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-shu">
                    <span>
                      <span className="block">{s.mode === 'exam' ? EXAM_KIND_LABEL[s.examKind ?? 'full'] : '練習'}</span>
                      <span className="text-xs text-ink-faint">{formatDate(s.finishedAt, true)}</span>
                    </span>
                    <span className="font-serif text-lg text-shu">{pct(s.correct, s.total)}%<span className="ml-1 text-xs text-ink-faint">{s.correct}/{s.total}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, unit, sub, to }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub?: string; to?: string }) {
  const body = (
    <div className="card p-5">
      <div className="flex items-center gap-1.5 text-xs text-ink-faint">{icon}{label}</div>
      <div className="mt-2 font-serif text-4xl">{value}<span className="ml-1 text-base text-ink-faint">{unit}</span></div>
      {sub && <div className="mt-1 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
  return to ? <Link to={to} className="block transition hover:-translate-y-0.5">{body}</Link> : body;
}

function Action({ to, icon, title, sub }: { to: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 transition hover:shadow-lift">
      <span className="rounded-full bg-shu-soft p-2.5 text-shu">{icon}</span>
      <span><b className="block">{title}</b><span className="text-xs text-ink-faint">{sub}</span></span>
    </Link>
  );
}
