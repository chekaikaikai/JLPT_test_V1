import clsx from 'clsx';
import { Clock, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorNote, Modal, Spinner } from '../../components/ui';
import { useBank } from '../../contexts/BankContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { useUserData } from '../../contexts/UserDataContext';
import { EXAM_KIND_LABEL, sectionsForKind, totalMinutes, totalQuestions } from '../../data/blueprints';
import { getRun, putRun, clearRun } from '../../services/repository';
import { createExamRun } from '../../services/runs';
import { buildExam } from '../../services/selection';
import type { ActiveRun, ExamKind } from '../../types';

const KINDS: ExamKind[] = ['full', 'vocab', 'grammar_reading'];

export default function ExamSetupPage() {
  const { level } = usePrefs();
  const { index } = useBank();
  const { scope, loading } = useUserData();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ExamKind>('full');
  const [saved, setSaved] = useState<ActiveRun | null>(null);
  const [shortages, setShortages] = useState<string[]>([]);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    getRun(scope, 'exam').then((r) => setSaved(r ?? null));
  }, [scope]);

  const sections = sectionsForKind(level, kind);

  const start = async () => {
    const built = buildExam(index, level, kind);
    if (!built.ok) {
      setShortages(built.shortages);
      setConfirmReplace(false);
      return;
    }
    setShortages([]);
    await putRun(scope, createExamRun(level, kind, built.questionIds, built.sections));
    navigate('/exam/run');
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl">正式模擬考　<span className="text-shu">{level}</span></h1>
        <p className="mt-1 text-sm text-ink-soft">依 {level} 的考試架構與時間配置出題（不含聽解）。作答中不會顯示答案，交卷後才公布。</p>
      </div>

      {saved && (
        <div className="card flex flex-wrap items-center gap-3 border-shu/40 bg-shu-soft/50 p-4 text-sm">
          <span>你有一場進行中的模擬考（{saved.level}・{EXAM_KIND_LABEL[saved.examKind ?? 'full']}）。</span>
          <button className="btn-primary btn-sm ml-auto" onClick={() => navigate('/exam/run')}>繼續作答</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={clsx('rounded-full border px-4 py-1.5 text-sm', kind === k ? 'border-shu bg-shu text-white' : 'border-line bg-card text-ink-soft hover:border-shu/40')}>
            {EXAM_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <section key={s.id} className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl">{s.name}</h2>
              <span className="inline-flex items-center gap-1 text-sm text-ink-soft"><Clock className="h-4 w-4" /> {s.minutes} 分鐘・{s.parts.reduce((n, p) => n + p.count, 0)} 題</span>
            </div>
            <ul className="mt-3 divide-y divide-line text-sm">
              {s.parts.map((p) => (
                <li key={p.label} className="flex justify-between py-2"><span className="ja">{p.label}</span><span className="text-ink-soft">{p.count} 題</span></li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-sand px-4 py-3 text-xs leading-6 text-ink-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          每一節各自計時，交卷（或時間到）後才能進入下一節，且無法回到前一節。題數為官方公布的目安，實際考試每回可能略有不同。
          成績為本站的<b>練習測驗分數（答對率）</b>，不是 JLPT 官方的等化分數，也不代表合格與否。
        </div>
      </div>

      {shortages.length > 0 && (
        <ErrorNote>
          <div className="font-medium">題庫不足，無法組成符合 {level} 規格的模擬考：</div>
          <ul className="mt-1 list-disc pl-5">{shortages.map((s) => <li key={s}>{s}</li>)}</ul>
          <div className="mt-1">為了維持考試規格，不會自動減少題數。請先補充題庫，或改用練習模式。</div>
        </ErrorNote>
      )}

      <div className="flex items-center gap-3">
        <button className="btn-primary px-8" onClick={() => (saved ? setConfirmReplace(true) : void start())}>開始考試</button>
        <span className="text-sm text-ink-soft">共 {totalQuestions(sections)} 題・{totalMinutes(sections)} 分鐘</span>
      </div>

      <Modal
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="放棄進行中的模擬考？"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmReplace(false)}>取消</button>
            <button className="btn-primary" onClick={async () => { await clearRun(scope, 'exam'); setSaved(null); await start(); }}>放棄並重新開始</button>
          </>
        }
      >
        開始新的模擬考會捨棄目前尚未交卷的作答內容。
      </Modal>
    </div>
  );
}
