import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useUserData } from '../../contexts/UserDataContext';
import { clearGuestData, guestSummary, importGuestInto, type GuestSummary } from '../../services/repository';

export const IMPORT_EVENT = 'jlpt:import-guest';

/** 登入後若本機仍有訪客資料，詢問是否匯入到帳號。 */
export function GuestImportDialog() {
  const { userId } = useAuth();
  const { reload, syncNow } = useUserData();
  const [summary, setSummary] = useState<GuestSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (force: boolean) => {
    if (!userId) return;
    const key = `jlpt.import-asked.${userId}`;
    if (!force && sessionStorage.getItem(key)) return;
    const s = await guestSummary();
    if (s.sessions + s.bookmarks + s.wrongs > 0) setSummary(s);
    else if (force) setSummary({ sessions: 0, bookmarks: 0, wrongs: 0 });
  }, [userId]);

  useEffect(() => {
    void check(false);
  }, [check]);
  useEffect(() => {
    const h = () => void check(true);
    window.addEventListener(IMPORT_EVENT, h);
    return () => window.removeEventListener(IMPORT_EVENT, h);
  }, [check]);

  if (!userId || !summary) return null;
  const empty = summary.sessions + summary.bookmarks + summary.wrongs === 0;
  const close = () => {
    sessionStorage.setItem(`jlpt.import-asked.${userId}`, '1');
    setSummary(null);
  };

  const doImport = async () => {
    setBusy(true);
    setError(null);
    try {
      await importGuestInto(userId);
      await clearGuestData();
      await reload();
      void syncNow();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '匯入失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="匯入訪客資料？"
      onClose={close}
      footer={
        empty ? (
          <button className="btn-primary" onClick={close}>知道了</button>
        ) : (
          <>
            <button className="btn-ghost" onClick={close} disabled={busy}>先不要</button>
            <button className="btn-primary" onClick={doImport} disabled={busy}>{busy ? '匯入中…' : '匯入並同步'}</button>
          </>
        )
      }
    >
      {empty ? (
        <p>這台裝置上沒有訪客資料。</p>
      ) : (
        <>
          <p>這台裝置上有你在訪客模式累積的紀錄，要匯入到目前的帳號嗎？</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>測驗紀錄：{summary.sessions} 筆</li>
            <li>收藏題目：{summary.bookmarks} 題</li>
            <li>錯題：{summary.wrongs} 題</li>
          </ul>
          <p className="mt-3 text-xs text-ink-faint">匯入後會上傳到雲端，並從訪客資料中移除。選「先不要」則訪客資料會繼續留在本機，之後可在「我的」頁面再匯入。</p>
          {error && <p className="mt-3 text-ng">{error}</p>}
        </>
      )}
    </Modal>
  );
}
