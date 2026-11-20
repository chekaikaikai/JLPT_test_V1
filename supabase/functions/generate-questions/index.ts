// Supabase Edge Function：AI 出題（預留架構，僅管理者可呼叫）
//
// 部署：
//   supabase functions deploy generate-questions
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   （金鑰只存在 Supabase，絕不放前端）
//
// 流程：驗證呼叫者是管理者 → 呼叫 AI → 驗證格式 → 以 service role 寫入 ai_generated_questions（status = pending）。
// 產生的題目不會進入 questions 正式題庫，必須由管理者審核後，呼叫 SQL 函式 publish_ai_question 才會發布。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const LEVELS = ['N5', 'N4'];
const SUBJECTS = ['vocabulary', 'grammar', 'reading'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Edge Function 執行環境內建，只存在伺服器端
  const aiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5';
  if (!aiKey) return json({ error: 'ANTHROPIC_API_KEY 尚未設定' }, 500);

  // 1) 以呼叫者的身分檢查是否為管理者（RLS / is_admin()）
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'unauthorized' }, 401);
  const { data: isAdmin } = await userClient.rpc('is_admin');
  if (!isAdmin) return json({ error: 'forbidden' }, 403);

  // 2) 驗證輸入
  const { level, subject, qtype, count = 5 } = await req.json().catch(() => ({}));
  if (!LEVELS.includes(level) || !SUBJECTS.includes(subject) || typeof qtype !== 'string') return json({ error: 'invalid input' }, 400);
  const n = Math.min(Math.max(Number(count) || 1, 1), 10);

  // 3) 呼叫 AI
  const prompt = `你是日本語能力試驗（JLPT ${level}）的出題專家。請產生 ${n} 題「${subject} / ${qtype}」題目。
要求：只有一個明確正確答案；日語自然、符合 ${level} 程度；4 個選項合理且不重複；解析使用繁體中文。
只輸出 JSON 陣列，不要任何其他文字。每個元素格式：
{"stem": string, "options": [string,string,string,string], "answer_index": 0-3, "explanation_zh": string, "note_ja": string|null,
 "vocab": [{"word":string,"reading":string,"meaning":string}], "grammar": [{"pattern":string,"meaning":string}], "difficulty": 1-3,
 "passage": {"genre": "essay|life|notice|email|info|blank", "title": string|null, "body": string} | 省略}`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!aiRes.ok) return json({ error: 'AI request failed', detail: await aiRes.text() }, 502);
  const ai = await aiRes.json();
  const text: string = ai.content?.map((c: { text?: string }) => c.text ?? '').join('') ?? '';

  let items: unknown;
  try {
    items = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return json({ error: 'AI 回傳格式無法解析' }, 502);
  }
  if (!Array.isArray(items)) return json({ error: 'AI 回傳格式錯誤' }, 502);

  // 4) 驗證每一題的基本結構
  const valid = items.filter((x: any) =>
    typeof x?.stem === 'string' && Array.isArray(x.options) && x.options.length === 4 &&
    new Set(x.options).size === 4 && Number.isInteger(x.answer_index) && x.answer_index >= 0 && x.answer_index <= 3 &&
    typeof x.explanation_zh === 'string');

  // 5) 以 service role 寫入「待審核」區（預設 pending，不會出現在正式題庫）
  const admin = createClient(url, service);
  const rows = valid.map((payload: unknown) => ({ level, subject, qtype, payload, model, status: 'pending', created_by: userData.user!.id }));
  if (rows.length === 0) return json({ error: 'AI 沒有產生有效題目' }, 502);
  const { error } = await admin.from('ai_generated_questions').insert(rows);
  if (error) return json({ error: error.message }, 500);

  return json({ inserted: rows.length, skipped: items.length - rows.length, status: 'pending' });
});
