import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { InstallButton } from '../../components/PwaPrompts';
import { ErrorNote } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useBank } from '../../contexts/BankContext';
import { useUserData } from '../../contexts/UserDataContext';
import { useOnline } from '../../hooks/useOnline';
import { formatDate } from '../../utils';
import { IMPORT_EVENT } from './GuestImportDialog';

export default function ProfilePage() {
  const { userId, email, profile, updateProfile, signOut } = useAuth();
  const { sync, syncNow } = useUserData();
  const bank = useBank();
  const online = useOnline();
  const [nick, setNick] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!userId) return <Navigate to="/login" replace />;
  const nickname = nick ?? profile?.nickname ?? '';

  const save = async () => {
    setMsg('');
    setErr('');
    if (!nickname.trim() || nickname.trim().length > 20) return setErr('暱稱需為 1～20 個字。');
    try {
      await updateProfile({ nickname: nickname.trim() });
      setMsg('已儲存。');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '儲存失敗');
    }
  };

  const srcLabel = { builtin: '內建題庫', cache: '雲端題庫（本機快取）', cloud: '雲端題庫（最新）' }[bank.source];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-3xl">我的帳號</h1>
      <section className="card space-y-4 p-6">
        <div>
          <div className="label">Email</div>
          <div className="text-sm">{email}</div>
        </div>
        <div>
          <label className="label" htmlFor="nick">暱稱</label>
          <div className="flex gap-2">
            <input id="nick" className="input" value={nickname} maxLength={20} onChange={(e) => setNick(e.target.value)} />
            <button className="btn-primary" onClick={save}>儲存</button>
          </div>
          {msg && <p className="mt-1 text-xs text-ok">{msg}</p>}
          {err && <p className="mt-1 text-xs text-ng">{err}</p>}
        </div>
        {profile && <div className="text-xs text-ink-faint">註冊日期：{formatDate(profile.createdAt)}</div>}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg">雲端同步</h2>
        <p className="text-sm text-ink-soft">
          狀態：{!online ? '離線（連線後自動同步）' : sync.status === 'syncing' ? '同步中…' : sync.status === 'error' ? '同步失敗' : '已同步'}
          {sync.pending > 0 && `，${sync.pending} 筆待上傳`}
          {sync.lastSyncAt && `，上次同步 ${formatDate(sync.lastSyncAt, true)}`}
        </p>
        {sync.error && <ErrorNote>{sync.error}</ErrorNote>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" onClick={() => void syncNow()}>立即同步</button>
          <button className="btn-secondary btn-sm" onClick={() => window.dispatchEvent(new Event(IMPORT_EVENT))}>匯入訪客資料</button>
        </div>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg">題庫與離線</h2>
        <p className="text-sm text-ink-soft">
          目前使用：{srcLabel}，共 {bank.index.questions.length} 題。
          {bank.updatedAt && ` 雲端題庫更新於 ${formatDate(bank.updatedAt, true)}。`}
          題庫已儲存在裝置上，離線也能練習。
        </p>
        {bank.error && <ErrorNote>{bank.error}</ErrorNote>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" onClick={() => void bank.refresh()} disabled={bank.refreshing || !online}>{bank.refreshing ? '更新中…' : '更新題庫'}</button>
          <InstallButton />
        </div>
      </section>

      <div className="flex justify-between">
        <Link to="/" className="btn-ghost">返回首頁</Link>
        <button className="btn-secondary" onClick={() => void signOut()}>登出</button>
      </div>
    </div>
  );
}
