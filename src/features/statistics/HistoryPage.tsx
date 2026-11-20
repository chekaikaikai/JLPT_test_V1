import { History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, SegTabs, Spinner } from '../../components/ui';
import { useUserData } from '../../contexts/UserDataContext';
import { EXAM_KIND_LABEL } from '../../data/blueprints';
import { SUBJECT_META } from '../../data/meta';
import { accuracyTrend, dailyCounts, overall, subjectCompare, weeklyTrend } from '../../services/stats';
import { formatDate, formatDuration, pct } from '../../utils';

const RED = '#C9402B';
const GREEN = '#4F8458';
const GRID = '#E6DECD';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h3 className="mb-3 text-base">{title}</h3>
      <div className="h-56">{children}</div>
    </section>
  );
}

export default function HistoryPage() {
  const { sessions, loading } = useUserData();
  const [level, setLevel] = useState<'all' | 'N5' | 'N4'>('all');
  const [mode, setMode] = useState<'all' | 'practice' | 'exam'>('all');

  const list = useMemo(() => sessions.filter((s) => (level === 'all' || s.level === level) && (mode === 'all' || s.mode === mode)), [sessions, level, mode]);
  const daily = useMemo(() => dailyCounts(list), [list]);
  const weekly = useMemo(() => weeklyTrend(list), [list]);
  const trend = useMemo(() => accuracyTrend(list), [list]);
  const compare = useMemo(() => subjectCompare(list).map((c) => ({ ...c, name: SUBJECT_META[c.subject].label })), [list]);
  const all = overall(list);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">學習紀錄</h1>
        <p className="mt-1 text-sm text-ink-soft">共 {list.length} 次測驗・{all.total} 題・整體正確率 {all.total ? `${all.accuracy}%` : '—'}{list[0] && `・最近學習 ${formatDate(list[0].finishedAt, true)}`}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <SegTabs value={level} onChange={setLevel} options={[{ value: 'all', label: '全部等級' }, { value: 'N5', label: 'N5' }, { value: 'N4', label: 'N4' }]} />
        <SegTabs value={mode} onChange={setMode} options={[{ value: 'all', label: '全部' }, { value: 'practice', label: '練習' }, { value: 'exam', label: '模擬考' }]} />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="還沒有符合條件的紀錄" action={<Link to="/practice" className="btn-primary">開始練習</Link>}>
          完成一次練習或模擬考後，這裡會顯示統計圖表與歷史紀錄。
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="每日練習題數（近 14 天）">
              <ResponsiveContainer>
                <BarChart data={daily}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} /><Tooltip formatter={(v) => [`${v} 題`, '練習']} /><Bar dataKey="count" fill={RED} radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="每週答題趨勢（正確率 %）">
              <ResponsiveContainer>
                <LineChart data={weekly}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} /><Tooltip formatter={(v, n) => [n === 'accuracy' ? `${v}%` : `${v} 題`, n === 'accuracy' ? '正確率' : '題數']} /><Line type="monotone" dataKey="accuracy" stroke={RED} strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="整體正確率變化（累計）">
              <ResponsiveContainer>
                <LineChart data={trend}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} /><Tooltip formatter={(v, n) => [`${v}%`, n === 'cumulative' ? '累計正確率' : '單次正確率']} /><Line type="monotone" dataKey="cumulative" stroke={RED} strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="session" stroke={GREEN} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2 }} /></LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="各科目能力比較（正確率 %）">
              <ResponsiveContainer>
                <RadarChart data={compare} outerRadius="70%"><PolarGrid stroke={GRID} /><PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} /><Radar dataKey="accuracy" stroke={RED} fill={RED} fillOpacity={0.25} /><Tooltip formatter={(v) => [`${v}%`, '正確率']} /></RadarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 text-lg">測驗歷史</h2>
            <ul className="divide-y divide-line">
              {list.map((s) => (
                <li key={s.id}>
                  <Link to={`/result/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-sand/60">
                    <span className="chip">{s.level}</span>
                    <span className="w-28">{s.mode === 'exam' ? EXAM_KIND_LABEL[s.examKind ?? 'full'] : '練習'}</span>
                    <span className="text-ink-faint">{formatDate(s.finishedAt, true)}</span>
                    <span className="text-ink-faint">{formatDuration(s.durationSec)}</span>
                    <span className="ml-auto font-serif text-lg text-shu">{pct(s.correct, s.total)}%<span className="ml-1.5 text-xs text-ink-faint">{s.correct}/{s.total}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
