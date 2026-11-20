import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import type { Question } from '../types';

export function Explanation({ question: q, selected }: { question: Question; selected: number | null | undefined }) {
  const answered = selected !== null && selected !== undefined;
  const correct = answered && selected === q.answerIndex;
  return (
    <div className="space-y-4 rounded-xl border border-line bg-card p-4 sm:p-5" aria-live="polite">
      <div className={`flex items-center gap-2 font-medium ${correct ? 'text-ok' : answered ? 'text-ng' : 'text-ink-soft'}`}>
        {correct ? <CheckCircle2 className="h-5 w-5" /> : answered ? <XCircle className="h-5 w-5" /> : <MinusCircle className="h-5 w-5" />}
        {correct ? '答對了！' : answered ? '答錯了' : '未作答'}
        <span className="ml-auto text-sm font-normal text-ink-soft">正確答案：{q.answerIndex + 1}. {q.options[q.answerIndex]}</span>
      </div>
      <div>
        <div className="label">解析</div>
        <p className="text-sm leading-7">{q.explanationZh}</p>
      </div>
      {q.noteJa && (
        <div>
          <div className="label">日文補充</div>
          <p className="ja text-sm">{q.noteJa}</p>
        </div>
      )}
      {q.vocab.length > 0 && (
        <div>
          <div className="label">相關單字</div>
          <ul className="flex flex-wrap gap-2">
            {q.vocab.map((v) => (
              <li key={v.word + v.reading} className="rounded-lg bg-sand px-3 py-1.5 text-sm">
                <span className="ja font-medium">{v.word}</span>
                {v.reading !== v.word && <span className="ml-1 text-ink-faint">（{v.reading}）</span>}
                <span className="ml-2 text-ink-soft">{v.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {q.grammar.length > 0 && (
        <div>
          <div className="label">相關文法</div>
          <ul className="space-y-1 text-sm">
            {q.grammar.map((g) => (
              <li key={g.pattern}>
                <span className="ja rounded bg-shu-soft px-2 py-0.5 text-shu">{g.pattern}</span>
                <span className="ml-2 text-ink-soft">{g.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
