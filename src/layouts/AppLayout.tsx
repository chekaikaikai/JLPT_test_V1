import { BookX, Bookmark, CloudOff, GraduationCap, History, Home, Loader2, PenLine, RefreshCw, User } from 'lucide-react';
import clsx from 'clsx';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { InstallButton, StatusBanners } from '../components/PwaPrompts';
import { LevelSwitcher } from '../components/LevelSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import { GuestImportDialog } from '../features/auth/GuestImportDialog';

const NAV = [
  { to: '/', label: '首頁', icon: Home, end: true },
  { to: '/practice', label: '練習', icon: PenLine },
  { to: '/exam', label: '模擬考', icon: GraduationCap },
  { to: '/wrong', label: '錯題本', icon: BookX },
  { to: '/history', label: '學習紀錄', icon: History },
];

function SyncBadge() {
  const { sync, syncNow, isGuest } = useUserData();
  if (isGuest) return <span className="chip hidden sm:inline-flex" title="資料只儲存在這台裝置">訪客・本機</span>;
  if (sync.status === 'syncing') return <span className="chip"><Loader2 className="h-3 w-3 animate-spin" /> 同步中</span>;
  if (sync.status === 'error')
    return (
      <button className="chip bg-ng-soft text-ng" onClick={() => void syncNow()} title={sync.error ?? ''}>
        <CloudOff className="h-3 w-3" /> 同步失敗，點此重試
      </button>
    );
  return (
    <button className="chip" onClick={() => void syncNow()} title="立即同步">
      <RefreshCw className="h-3 w-3" /> {sync.pending > 0 ? `${sync.pending} 筆待同步` : '已同步'}
    </button>
  );
}

export default function AppLayout() {
  const { userId, profile } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <StatusBanners />
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="seal h-9 w-9 font-serif text-lg leading-none">日</span>
            <span className="hidden font-serif text-lg leading-tight sm:block">JLPT Study</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="主選單">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('rounded-full px-3.5 py-1.5 text-sm transition', isActive ? 'bg-shu-soft font-medium text-shu' : 'text-ink-soft hover:bg-sand')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SyncBadge />
            <InstallButton className="hidden sm:inline-flex" />
            <NavLink to="/bookmarks" className="btn-ghost btn-sm" aria-label="收藏題目"><Bookmark className="h-4 w-4" /></NavLink>
            <NavLink to={userId ? '/profile' : '/login'} className="btn-secondary btn-sm">
              <User className="h-4 w-4" /> {userId ? profile?.nickname ?? '我的' : '登入'}
            </NavLink>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <LevelSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 md:pb-10">
        <Outlet />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur md:hidden" aria-label="底部選單">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-shu' : 'text-ink-faint')}>
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <GuestImportDialog />
    </div>
  );
}
