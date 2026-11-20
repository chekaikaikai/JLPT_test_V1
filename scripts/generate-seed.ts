/**
 * 由內建題庫（src/data/bank）產生 supabase/seed.sql。
 * 用法：npm run gen:seed
 * 題庫以 TypeScript 檔案為單一來源；seed.sql 可重複執行（upsert）。
 */
import { writeFileSync } from 'node:fs';
import { BUILTIN_BANK } from '../src/data/bank/index';

const q = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const j = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const lines: string[] = ['-- 由 scripts/generate-seed.ts 自動產生，請勿手動編輯。', 'begin;', ''];

for (const p of BUILTIN_BANK.passages) {
  lines.push(
    `insert into public.reading_passages (id, level, genre, title, body, source, status) values (${q(p.id)}, ${q(p.level)}, ${q(p.genre)}, ${q(p.title)}, ${q(p.body)}, ${q(p.source)}, ${q(p.status)})` +
      ` on conflict (id) do update set level = excluded.level, genre = excluded.genre, title = excluded.title, body = excluded.body, status = excluded.status;`,
  );
}
lines.push('');
for (const x of BUILTIN_BANK.questions) {
  lines.push(
    `insert into public.questions (id, level, subject, qtype, difficulty, stem, passage_id, options, answer_index, explanation_zh, note_ja, vocab, grammar, source, status) values (` +
      [q(x.id), q(x.level), q(x.subject), q(x.type), x.difficulty, q(x.stem), q(x.passageId), j(x.options), x.answerIndex, q(x.explanationZh), q(x.noteJa), j(x.vocab), j(x.grammar), q(x.source), q(x.status)].join(', ') +
      `) on conflict (id) do update set stem = excluded.stem, passage_id = excluded.passage_id, options = excluded.options, answer_index = excluded.answer_index, explanation_zh = excluded.explanation_zh, note_ja = excluded.note_ja, vocab = excluded.vocab, grammar = excluded.grammar, difficulty = excluded.difficulty, status = excluded.status;`,
  );
}
lines.push('', 'commit;', '');
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), lines.join('\n'), 'utf8');
console.log(`seed.sql 已產生：${BUILTIN_BANK.questions.length} 題、${BUILTIN_BANK.passages.length} 篇文章`);
