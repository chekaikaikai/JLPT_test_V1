import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ErrorNote, Spinner } from '../../components/ui';
import { useBank } from '../../contexts/BankContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { useUserData } from '../../contexts/UserDataContext';
import { SUBJECT_META, TYPE_META, typesOfSubject } from '../../data/meta';
import { clearRun, getRun } from '../../services/repository';
import { buildPractice } from '../../services/selection';
import type { ActiveRun, PracticeConfig, PracticeCount, QuestionType, Subject } from '../../types';
import { SUBJECTS } from '../../types';
import { usePracticeStart } from './usePracticeStart';

const COUNTS: PracticeCount[] = [10, 20, 30, 'all'];

export default function PracticeSetupPage() {
  const { level, practiceCount, practiceSubject, update } = usePrefs();
  const { index } = useBank();
  const { scope, wrongIds, bookmarkIds, loading } = useUserData();
  const location = useLocation();
  const navigate = useNavigate();
  const preset = (location.state as { preset?: Partial<PracticeConfig> } | null)?.preset;
  const { start, error, setError } = usePracticeStart();

  const [subject, setSubject] = useState<Subject | 'all'>(preset?.subject ?? practiceSubject);
  const [types, setTypes] = useState<QuestionType[]>(preset?.types ?? []);
  const [count, setCount] = useState<PracticeCount>(preset?.count ?? practiceCount);
  const [onlyWrong, setOnlyWrong] = useState(preset?.onlyWrong ?? false);
  const [onlyBookmarked, setOnlyBookmarked] = useState(preset?.onlyBookmarked ?? false);
  const [saved, setSaved] = useState<ActiveRun | null>(null);

  useEffect(() => {
    getRun(scope, 'practice').then((r) => setSaved(r ?? null));
  }, [scope]);
  useEffect(() => setTypes([]), [subject]);

  const config: PracticeConfig = { level, subject, types, count, onlyWrong, onlyBookmarked };
  const poolSize = useMemo(() => buildPractice(index, config, wrongIds, bookmarkIds).poolSize, [index, level, subject, types, count, onlyWrong, onlyBookmarked, wrongIds, bookmarkIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const typeOptions = subject === 'all' ? [] : typesOfSubject(subject);

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl">練習模式</h1>
        <p className="mt-1 text-sm text-ink-soft">每題作答後立即顯示答案與解析。目前等級：<b className="text-shu">{level}</b></p>
      </div>

      {saved && saved.level === level && (
        <div className="card flex flex-wrap items-center gap-3 border-shu/40 bg-shu-soft/50 p-4 text-sm">
          <span>你有一份尚未完成的練習（{Object.keys(saved.answers).length}／{saved.questionIds.length} 題）。</span>
          <button className="btn-primary btn-sm ml-auto" onClick={() => navigate('/practice/run')}>繼續作答</button>
          <button className="btn-ghost btn-sm" onClick={async () => { await clearRun(scope, 'practice'); setSaved(null); }}>放棄</button>
        </div>
      )}

      <section className="card space-y-5 p-5 sm:p-6">
        <div>
          <div className="label">科目</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['all', ...SUBJECTS] as const).map((s) => (
              <button key={s} onClick={() => { setSubject(s); update({ practiceSubject: s }); }} className={clsx('rounded-xl border px-3 py-3 text-left text-sm transition', subject === s ? 'border-shu bg-shu-soft' : 'border-line bg-card hover:border-shu/40')}>
                <div className="font-medium">{s === 'all' ? '綜合' : SUBJECT_META[s].label}</div>
                <div className="mt-0.5 text-[11px] text-ink-faint">{s === 'all' ? '三科混合' : SUBJECT_META[s].description}</div>
              </button>
            ))}
          </div>
        </div>

        {typeOptions.length > 0 && (
          <div>
            <div className="label">題型（不選＝全部）</div>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((t) => {
                const on = types.includes(t);
                return (
                  <button key={t} onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])} aria-pressed={on} className={clsx('rounded-full border px-3.5 py-1.5 text-sm transition', on ? 'border-shu bg-shu text-white' : 'border-line bg-card text-ink-soft hover:border-shu/40')}>
                    {TYPE_META[t].label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="label">題數</div>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((c) => (
              <button key={String(c)} onClick={() => { setCount(c); update({ practiceCount: c }); }} className={clsx('rounded-full border px-4 py-1.5 text-sm', count === c ? 'border-shu bg-shu text-white' : 'border-line bg-card text-ink-soft hover:border-shu/40')}>
                {c === 'all' ? '全部' : `${c} 題`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-shu" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
            只練習錯題（目前 {[...wrongIds].filter((id) => index.byId.get(id)?.level === level).length} 題）
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-shu" checked={onlyBookmarked} onChange={(e) => setOnlyBookmarked(e.target.checked)} />
            練習收藏題目（目前 {[...bookmarkIds].filter((id) => index.byId.get(id)?.level === level).length} 題）
          </label>
          {onlyWrong && onlyBookmarked && <p className="text-xs text-ink-faint">兩個都勾選時，會從「錯題＋收藏」的聯集中抽題。</p>}
        </div>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center gap-3">
        <button className="btn-primary px-8" disabled={poolSize === 0} onClick={() => { setError(null); void start(config); }}>開始練習</button>
        <span className="text-sm text-ink-soft">{poolSize > 0 ? `符合條件：${poolSize} 題` : '符合條件的題目為 0 題'}</span>
        <Link to="/exam" className="ml-auto text-sm text-ink-soft underline">改考模擬考</Link>
      </div>
    </div>
  );
}
