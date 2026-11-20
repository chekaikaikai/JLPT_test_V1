import { Bookmark } from 'lucide-react';
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
import { usePracticeStart } from '../practice/usePracticeStart';

export default function BookmarksPage() {
  const { level: current } = usePrefs();
  const { bookmarks, toggleBookmark, loading } = useUserData();
  const { index } = useBank();
  const { start, error } = usePracticeStart();
  const [level, setLevel] = useState<Level>(current);
  const [subject, setSubject] = useState<Subject | 'all'>('all');

  if (loading) return <Spinner />;
  const list = bookmarks.filter((b) => b.level === level && (subject === 'all' || b.subject === subject) && index.byId.has(b.questionId));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">收藏題目</h1>
          <p className="mt-1 text-sm text-ink-soft">在練習或檢討時按下「收藏」，就會集中在這裡。</p>
        </div>
        <button className="btn-primary" disabled={list.length === 0} onClick={() => void start({ level, subject: 'all', types: [], count: 'all', onlyWrong: false, onlyBookmarked: false, ids: list.map((b) => b.questionId) })}>
          練習這 {list.length} 題
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SegTabs value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
        <SegTabs value={subject} onChange={setSubject} options={[{ value: 'all', label: '全部' }, ...SUBJECTS.map((s) => ({ value: s, label: SUBJECT_META[s].label }))]} />
      </div>
      {error && <p className="text-sm text-ng">{error}</p>}
      {list.length === 0 ? (
        <EmptyState icon={<Bookmark className="h-8 w-8" />} title="沒有收藏的題目" action={<Link to="/practice" className="btn-primary">去練習</Link>}>
          這個等級與科目下還沒有收藏。
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <QuestionReviewCard key={b.questionId} question={index.byId.get(b.questionId)!} selected={undefined} actions={<button className="btn-secondary btn-sm" onClick={() => void toggleBookmark(index.byId.get(b.questionId)!)}>取消收藏</button>} />
          ))}
        </div>
      )}
    </div>
  );
}
