import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ErrorNote } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { isValidEmail } from '../../utils';

function Shell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { configured } = useAuth();
  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-6 text-center">
        <h1 className="text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      <div className="card p-6">
        {!configured && (
          <div className="mb-4"><ErrorNote>尚未設定 Supabase（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY），會員功能暫時無法使用。你仍可用訪客模式練習。</ErrorNote></div>
        )}
        {children}
      </div>
      {footer && <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div>}
    </div>
  );
}

function Field({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>{label}</label>
      <input className="input" {...props} aria-invalid={!!error} />
      {error && <p className="mt-1 text-xs text-ng">{error}</p>}
    </div>
  );
}

export function LoginPage() {
  const { signIn, userId, configured } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (userId) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!isValidEmail(email)) v.email = '請輸入有效的 Email。';
    if (!password) v.password = '請輸入密碼。';
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="登入" subtitle="登入後，紀錄會同步到所有裝置。" footer={<>還沒有帳號？<Link to="/register" className="text-shu underline">註冊</Link>　·　<Link to="/" className="underline">繼續使用訪客模式</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errs.email} />
        <Field id="password" label="密碼" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errs.password} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <button className="btn-primary w-full" disabled={busy || !configured}>{busy ? '登入中…' : '登入'}</button>
        <div className="text-center"><Link to="/forgot-password" className="text-xs text-ink-soft underline">忘記密碼？</Link></div>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { signUp, userId, configured } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ nickname: '', email: '', password: '', confirm: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  if (userId) return <Navigate to="/" replace />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!f.nickname.trim() || f.nickname.trim().length > 20) v.nickname = '暱稱需為 1～20 個字。';
    if (!isValidEmail(f.email)) v.email = '請輸入有效的 Email。';
    if (f.password.length < 8) v.password = '密碼至少 8 個字元。';
    if (f.confirm !== f.password) v.confirm = '兩次輸入的密碼不一致。';
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setError('');
    try {
      const { needsConfirm } = await signUp(f.email, f.password, f.nickname.trim());
      if (needsConfirm) setNotice('註冊成功！請到信箱點擊驗證連結，完成後即可登入。');
      else nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="建立帳號" subtitle="免費註冊，跨裝置同步學習紀錄。" footer={<>已經有帳號？<Link to="/login" className="text-shu underline">登入</Link></>}>
      {notice ? (
        <div className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">{notice}</div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="nickname" label="暱稱" value={f.nickname} onChange={set('nickname')} error={errs.nickname} maxLength={20} />
          <Field id="email" label="Email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errs.email} />
          <Field id="password" label="密碼（至少 8 個字元）" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errs.password} />
          <Field id="confirm" label="確認密碼" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={errs.confirm} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <button className="btn-primary w-full" disabled={busy || !configured}>{busy ? '建立中…' : '註冊'}</button>
        </form>
      )}
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const { sendReset, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return setErr('請輸入有效的 Email。');
    setBusy(true);
    setErr('');
    try {
      await sendReset(email);
      setSent(true);
    } catch (x) {
      setErr(x instanceof Error ? x.message : '寄送失敗');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="忘記密碼" subtitle="輸入註冊的 Email，我們會寄送重設連結。" footer={<Link to="/login" className="underline">回到登入</Link>}>
      {sent ? (
        <div className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">如果這個 Email 已註冊，重設連結已寄出，請查看信箱（包含垃圾郵件匣）。</div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err} />
          <button className="btn-primary w-full" disabled={busy || !configured}>{busy ? '寄送中…' : '寄送重設連結'}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const { updatePassword, recovering, userId } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!recovering && !userId)
    return (
      <Shell title="重設密碼" footer={<Link to="/forgot-password" className="underline">重新寄送重設連結</Link>}>
        <p className="text-sm text-ink-soft">此頁面需要從重設密碼信件中的連結進入。連結可能已過期。</p>
      </Shell>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (pw.length < 8) v.pw = '密碼至少 8 個字元。';
    if (confirm !== pw) v.confirm = '兩次輸入的密碼不一致。';
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await updatePassword(pw);
      nav('/', { replace: true });
    } catch (x) {
      setError(x instanceof Error ? x.message : '更新失敗');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="設定新密碼">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="pw" label="新密碼（至少 8 個字元）" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={errs.pw} />
        <Field id="confirm" label="確認新密碼" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errs.confirm} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? '更新中…' : '更新密碼'}</button>
      </form>
    </Shell>
  );
}
