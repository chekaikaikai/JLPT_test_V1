import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { useBank } from '../contexts/BankContext';
import { TYPE_META } from '../data/meta';
import type { Question } from '../types';
import { Explanation } from './Explanation';
import { QuestionView } from './QuestionView';
import { RichJa } from './RichJa';

/** 可展開的題目卡片：收合時顯示題幹摘要，展開後顯示完整題目、答案與解析。 */
export function QuestionReviewCard({ question: q, selected, status, meta, actions, defaultOpen = false }: {
  question: Question;
  selected: number | null | undefined;
  status?: 'right' | 'wrong' | 'none';
  meta?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { index } = useBank();
  const passage = q.passageId ? index.passageById.get(q.passageId) : undefined;
  return (
    <div className={clsx('card overflow-hidden', status === 'right' && 'border-ok/50', status === 'wrong' && 'border-ng/50')}>
      <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={clsx('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', status === 'right' ? 'bg-ok' : status === 'wrong' ? 'bg-ng' : 'bg-line')} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
            <span className="chip">{q.level}</span>
            <span className="chip">{TYPE_META[q.type].label}</span>
            {meta}
          </div>
          <RichJa text={q.passageId && q.type === 'text_grammar' ? `${q.stem}（文章題）` : q.stem} className="line-clamp-2 block text-base" />
        </div>
        <ChevronDown className={clsx('mt-1 h-4 w-4 shrink-0 text-ink-faint transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line p-4 sm:p-5">
          <QuestionView question={q} passage={passage} selected={selected ?? undefined} reveal disabled />
          <Explanation question={q} selected={selected} />
          {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
