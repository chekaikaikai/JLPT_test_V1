-- ============================================================
-- JLPT Study App — 初始資料庫結構
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或用 `supabase db push`
-- ============================================================

-- ───────── 共用函式 ─────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────── 管理者名單 ─────────
-- 只有 service role / SQL Editor 能新增管理者；一般使用者完全無法讀寫此表。
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- 刻意不建立任何 policy：anon / authenticated 無法直接存取。

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ───────── profiles ─────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text not null default '學習者' check (char_length(nickname) between 1 and 20),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 註冊時自動建立 profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nickname)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(new.raw_user_meta_data->>'nickname', ''), split_part(new.email, '@', 1), '學習者'), 20)
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── 讀解文章 ─────────
create table public.reading_passages (
  id text primary key,
  level text not null check (level in ('N5','N4','N3','N2','N1')),
  genre text not null check (genre in ('essay','life','notice','email','info','blank')),
  title text,
  body text not null,
  source text not null default 'original' check (source in ('original','ai','community')),
  status text not null default 'pending' check (status in ('approved','pending','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reading_passages_level_status_idx on public.reading_passages (level, status);
create trigger reading_passages_updated_at before update on public.reading_passages
  for each row execute function public.set_updated_at();

-- ───────── 正式題庫 ─────────
-- 選項（question_options）以 JSONB 陣列儲存在 options 欄位：["選項1","選項2","選項3","選項4"]
create table public.questions (
  id text primary key,
  level text not null check (level in ('N5','N4','N3','N2','N1')),
  subject text not null check (subject in ('vocabulary','grammar','reading')),
  qtype text not null check (qtype in (
    'kanji_reading','orthography','contextual','paraphrase','usage',
    'grammar_form','sentence_composition','text_grammar',
    'reading_short','reading_life','reading_notice','reading_mid','reading_info')),
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  stem text not null,
  passage_id text references public.reading_passages(id) on delete set null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  answer_index smallint not null check (answer_index between 0 and 3),
  explanation_zh text not null,
  note_ja text,
  vocab jsonb not null default '[]'::jsonb,
  grammar jsonb not null default '[]'::jsonb,
  source text not null default 'original' check (source in ('original','ai','community')),
  status text not null default 'pending' check (status in ('approved','pending','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_level_subject_idx on public.questions (level, subject, status);
create index questions_type_idx on public.questions (level, qtype, status);
create index questions_passage_idx on public.questions (passage_id);
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

-- ───────── 測驗紀錄 ─────────
-- id 由前端產生（uuid），同一份測驗重複上傳會 upsert 而不會重複。
create table public.quiz_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('practice','exam')),
  level text not null check (level in ('N5','N4','N3','N2','N1')),
  subject text not null check (subject in ('all','vocabulary','grammar','reading')),
  exam_kind text check (exam_kind in ('full','vocab','grammar_reading')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_sec integer not null check (duration_sec >= 0),
  time_limit_sec integer,
  total integer not null check (total >= 0),
  correct integer not null check (correct >= 0 and correct <= total),
  config jsonb,
  created_at timestamptz not null default now()
);
create index quiz_sessions_user_finished_idx on public.quiz_sessions (user_id, finished_at desc);

create table public.quiz_answers (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 題目若日後被下架，保留作答紀錄（question_id 設為 null），統計用 subject / qtype 快照
  question_id text references public.questions(id) on delete set null,
  position integer not null default 0,
  selected_index smallint check (selected_index between 0 and 3),
  is_correct boolean not null,
  subject text not null,
  qtype text not null,
  flagged boolean not null default false,
  unique (session_id, question_id)
);
create index quiz_answers_session_idx on public.quiz_answers (session_id);
create index quiz_answers_user_idx on public.quiz_answers (user_id);

-- ───────── 收藏 ─────────
create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  level text not null,
  subject text not null,
  qtype text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- ───────── 錯題 ─────────
create table public.wrong_questions (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  level text not null,
  subject text not null,
  qtype text not null,
  wrong_count integer not null default 1 check (wrong_count >= 1),
  last_wrong_at timestamptz not null default now(),
  last_selected_index smallint check (last_selected_index between 0 and 3),
  primary key (user_id, question_id)
);
create index wrong_questions_user_level_idx on public.wrong_questions (user_id, level);

-- ───────── AI 產生題目（待審核區）─────────
-- 只有管理者可讀寫；Edge Function 以 service role 寫入。
create table public.ai_generated_questions (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('N5','N4','N3','N2','N1')),
  subject text not null check (subject in ('vocabulary','grammar','reading')),
  qtype text not null,
  payload jsonb not null,                -- 完整題目（含 passage）草稿
  model text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_question_id text references public.questions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_generated_status_idx on public.ai_generated_questions (status, level, subject);
create trigger ai_generated_updated_at before update on public.ai_generated_questions
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.reading_passages enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.bookmarks enable row level security;
alter table public.wrong_questions enable row level security;
alter table public.ai_generated_questions enable row level security;

-- profiles：只能讀寫自己的
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 題庫 / 文章：所有人只能讀「已審核（approved）」；寫入僅管理者
create policy questions_select_approved on public.questions for select to anon, authenticated
  using (status = 'approved' or public.is_admin());
create policy questions_admin_write on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy passages_select_approved on public.reading_passages for select to anon, authenticated
  using (status = 'approved' or public.is_admin());
create policy passages_admin_write on public.reading_passages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 測驗紀錄：只能操作自己的
create policy sessions_own on public.quiz_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy answers_own on public.quiz_answers for all to authenticated
  using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.quiz_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- 收藏、錯題：只能操作自己的
create policy bookmarks_own on public.bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wrong_own on public.wrong_questions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI 待審核題目：僅管理者
create policy ai_admin_all on public.ai_generated_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────── 權限（再加一層保險）─────────
revoke all on all tables in schema public from anon;
grant select on public.questions, public.reading_passages to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.admin_users from authenticated;
revoke all on public.admin_users from anon;
grant usage, select on all sequences in schema public to authenticated;

-- ───────── 發布 AI 題目（管理者專用）─────────
-- 將審核通過的 AI 題目複製到正式題庫。
create or replace function public.publish_ai_question(p_id uuid, p_question_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.ai_generated_questions;
  pl jsonb;
  pid text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into r from public.ai_generated_questions where id = p_id and status = 'pending';
  if not found then raise exception 'not found or not pending'; end if;
  pl := r.payload;
  pid := null;
  if pl ? 'passage' then
    pid := p_question_id || '-ps';
    insert into public.reading_passages (id, level, genre, title, body, source, status)
    values (pid, r.level, coalesce(pl->'passage'->>'genre','essay'), pl->'passage'->>'title', pl->'passage'->>'body', 'ai', 'approved');
  end if;
  insert into public.questions (id, level, subject, qtype, difficulty, stem, passage_id, options, answer_index,
                                explanation_zh, note_ja, vocab, grammar, source, status, reviewed_by, reviewed_at)
  values (p_question_id, r.level, r.subject, r.qtype, coalesce((pl->>'difficulty')::smallint, 2), pl->>'stem', pid,
          pl->'options', (pl->>'answer_index')::smallint, pl->>'explanation_zh', pl->>'note_ja',
          coalesce(pl->'vocab','[]'::jsonb), coalesce(pl->'grammar','[]'::jsonb), 'ai', 'approved', auth.uid(), now());
  update public.ai_generated_questions
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), published_question_id = p_question_id
   where id = p_id;
end $$;
revoke all on function public.publish_ai_question(uuid, text) from public, anon;
grant execute on function public.publish_ai_question(uuid, text) to authenticated;
