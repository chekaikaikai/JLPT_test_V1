import { BookX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QuestionReviewCard } from '../../components/QuestionReviewCard';
import { EmptyState, SegTabs, Spinner } from '../../components/ui';
import { useBank } from '../../contexts/BankContext';
import { usePrefs } from '../../contexts/PrefsContext';
import { useUserData } from '../../contexts/UserDataContext';
import { SUBJECT_META } from '../../data/meta';
import type { Level, Subject } from '../../types';
import { LEVELS, SUBJECTS } from '../../types';
import { formatDate } from '../../utils';
import { usePracticeStart } from '../practice/usePracticeStart';

export default function WrongQuestionsPage() {
  const { level: current } = usePrefs();
  const { wrongs, removeWrong, loading } = useUserData();
  const { index } = useBank();
  const { start, error } = usePracticeStart();
  const [level, setLevel] = useState<Level>(current);
  const [subject, setSubject] = useState<Subject | 'all'>('all');

  if (loading) return <Spinner />;
  const list = wrongs.filter((w) => w.level === level && (subject === 'all' || w.subject === subject) && index.byId.has(w.questionId));
  const total = wrongs.filter((w) => w.level === level).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">錯題本</h1>
          <p className="mt-1 text-sm text-ink-soft">答錯的題目會自動收錄；同一題重複答錯只會更新次數。</p>
        </div>
        <button className="btn-primary" disabled={list.length === 0} onClick={() => void start({ level, subject: 'all', types: [], count: 'all', onlyWrong: false, onlyBookmarked: false, ids: list.map((w) => w.questionId) })}>
          練習這 {list.length} 題
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegTabs value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
        <SegTabs value={subject} onChange={setSubject} options={[{ value: 'all', label: '全部' }, ...SUBJECTS.map((s) => ({ value: s, label: SUBJECT_META[s].label }))]} />
      </div>
      {error && <p className="text-sm text-ng">{error}</p>}

      {list.length === 0 ? (
        <EmptyState icon={<BookX className="h-8 w-8" />} title={total === 0 ? `${level} 還沒有錯題` : '這個篩選條件下沒有錯題'} action={<Link to="/practice" className="btn-primary">去練習</Link>}>
          {total === 0 ? '做練習或模擬考時答錯的題目會出現在這裡。' : '試試切換科目篩選。'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((w) => {
            const q = index.byId.get(w.questionId)!;
            return (
              <QuestionReviewCard
                key={w.questionId}
                question={q}
                selected={w.lastSelectedIndex}
                status="wrong"
                meta={<span>答錯 {w.wrongCount} 次・{formatDate(w.lastWrongAt)}</span>}
                actions={<button className="btn-secondary btn-sm" onClick={() => void removeWrong(w.questionId)}>從錯題本移除</button>}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
