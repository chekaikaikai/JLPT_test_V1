import { Download, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnline } from '../hooks/useOnline';
import { Modal } from './ui';

/** 離線提示 + 新版本更新提示 */
export function StatusBanners() {
  const online = useOnline();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // 每小時檢查一次新版本，避免舊快取長期停留
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });

  return (
    <div className="space-y-px">
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-xs text-white" role="status">
          <WifiOff className="h-3.5 w-3.5" /> 目前離線：可使用已下載的題庫練習，作答紀錄會暫存在裝置上，連線後自動同步。
        </div>
      )}
      {needRefresh && (
        <div className="flex items-center justify-center gap-3 bg-shu px-4 py-2 text-xs text-white" role="status">
          有新版本可用
          <button className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 hover:bg-white/30" onClick={() => updateServiceWorker(true)}>
            <RefreshCw className="h-3 w-3" /> 立即更新
          </button>
          <button aria-label="稍後" onClick={() => setNeedRefresh(false)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {offlineReady && (
        <div className="flex items-center justify-center gap-3 bg-ok px-4 py-2 text-xs text-white" role="status">
          已可離線使用
          <button aria-label="關閉" onClick={() => setOfflineReady(false)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
}

export function InstallButton({ className = '' }: { className?: string }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (standalone || (!evt && !isIOS)) return null;
  return (
    <>
      <button
        className={`btn-secondary btn-sm ${className}`}
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            setEvt(null);
          } else setIosHelp(true);
        }}
      >
        <Download className="h-4 w-4" /> 安裝 App
      </button>
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="加入主畫面" footer={<button className="btn-primary" onClick={() => setIosHelp(false)}>知道了</button>}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>用 Safari 開啟本網站。</li>
          <li>點下方的「分享」按鈕 <Share className="inline h-4 w-4" />。</li>
          <li>選擇「加入主畫面」，再按「新增」。</li>
        </ol>
      </Modal>
    </>
  );
}
