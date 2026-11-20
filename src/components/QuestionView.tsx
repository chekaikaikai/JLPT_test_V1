import clsx from 'clsx';
import { Bookmark, BookmarkCheck, Check, X } from 'lucide-react';
import { GENRE_LABEL, SUBJECT_META, TYPE_META } from '../data/meta';
import type { Passage, Question } from '../types';
import { RichJa } from './RichJa';

interface Props {
  question: Question;
  passage?: Passage;
  number?: number;
  selected: number | null | undefined;
  /** 顯示正確 / 錯誤狀態（練習作答後、成績檢討） */
  reveal?: boolean;
  disabled?: boolean;
  onSelect?: (i: number) => void;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  flagged?: boolean;
  onToggleFlag?: () => void;
}

/** 題目畫面：以題目為視覺焦點。同時用於練習、模擬考與結果檢討。 */
export function QuestionView({ question: q, passage, number, selected, reveal, disabled, onSelect, bookmarked, onToggleBookmark, flagged, onToggleFlag }: Props) {
  const meta = TYPE_META[q.type];
  const isBlank = q.type === 'text_grammar';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
        <span className="chip">{q.level}</span>
        <span className="chip">{SUBJECT_META[q.subject].label}</span>
        <span className="chip">{meta.label}</span>
        <span className="ml-auto flex items-center gap-1">
          {onToggleFlag && (
            <button type="button" onClick={onToggleFlag} className={clsx('btn-ghost btn-sm', flagged && 'bg-shu-soft text-shu')} aria-pressed={flagged}>
              {flagged ? '已標記待確認' : '標記待確認'}
            </button>
          )}
          {onToggleBookmark && (
            <button type="button" onClick={onToggleBookmark} className={clsx('btn-ghost btn-sm', bookmarked && 'text-shu')} aria-pressed={bookmarked} aria-label={bookmarked ? '取消收藏' : '收藏題目'}>
              {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {bookmarked ? '已收藏' : '收藏'}
            </button>
          )}
        </span>
      </div>

      <p className="text-xs text-ink-faint">{meta.hint}</p>

      {passage && (
        <div className="rounded-xl border border-line bg-sand/50 p-4 sm:p-5">
          <div className="mb-2 text-xs text-ink-faint">{GENRE_LABEL[passage.genre]}{passage.title ? `｜${passage.title}` : ''}</div>
          <RichJa text={passage.body} className="block text-[1.05rem]" />
        </div>
      )}

      <div className="flex gap-3">
        {number !== undefined && <span className="mt-1 font-serif text-lg text-shu">{number}.</span>}
        <RichJa text={q.stem} className={clsx('block', isBlank ? 'text-lg text-ink-soft' : 'text-xl sm:text-2xl')} />
      </div>

      <ul className="grid gap-2.5" role="radiogroup" aria-label="選項">
        {q.options.map((opt, i) => {
          const isSel = selected === i;
          const isAns = i === q.answerIndex;
          const state = reveal ? (isAns ? 'right' : isSel ? 'wrong' : 'idle') : isSel ? 'sel' : 'idle';
          return (
            <li key={i}>
              <button
                type="button"
                role="radio"
                aria-checked={isSel}
                disabled={disabled}
                onClick={() => onSelect?.(i)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                  state === 'idle' && 'border-line bg-card hover:border-shu/40 hover:bg-shu-soft/40',
                  state === 'sel' && 'border-shu bg-shu-soft',
                  state === 'right' && 'border-ok bg-ok-soft',
                  state === 'wrong' && 'border-ng bg-ng-soft',
                  disabled && 'cursor-default',
                )}
              >
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm',
                    state === 'right' ? 'border-ok bg-ok text-white' : state === 'wrong' ? 'border-ng bg-ng text-white' : state === 'sel' ? 'border-shu bg-shu text-white' : 'border-line text-ink-soft',
                  )}
                >
                  {state === 'right' ? <Check className="h-4 w-4" /> : state === 'wrong' ? <X className="h-4 w-4" /> : i + 1}
                </span>
                <RichJa text={opt} className="text-lg" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
