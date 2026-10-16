import { ArrowUpRight } from 'lucide-react';
import { tokenItem, useStorageItem } from '@/lib/settings';
import { leaveClassic } from '@/lib/classic';
import type { ProfileTab } from '@/lib/routes';
import { HomePage } from '@/pages/home/HomePage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { AchievementsPage } from '@/pages/profile/AchievementsPage';
import { FollowsPage } from '@/pages/profile/FollowsPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { RepositoriesPage } from '@/pages/profile/RepositoriesPage';
import { PrPage } from '@/pages/pr/PrPage';
import { RepoPage } from '@/pages/repo/RepoPage';
import { WorkListPage } from '@/pages/work/WorkListPage';
import { Toaster } from '@/ui/toast';
import { CommandPalette } from './CommandPalette';
import { Logo } from './Logo';
import { appState, authRejected } from './state';
import { TokenGate } from './TokenGate';

export function App() {
  const state = appState.use();
  const token = useStorageItem(tokenItem);
  const rejected = authRejected.use();

  if (state.mode === 'classic') return <ClassicPill />;
  if (token === null) return null;
  if (!token || rejected) return <TokenGate rejected={rejected} />;

  const { route } = state;
  return (
    <>
      {route.kind === 'home' && <HomePage />}
      {route.kind === 'work' && <WorkListPage key={`${route.type}/${route.filter}`} type={route.type} filter={route.filter} />}
      {route.kind === 'notifications' && <NotificationsPage />}
      {route.kind === 'profile' && <ProfileRoute key={route.login} login={route.login} tab={route.tab} />}
      {route.kind === 'pr' && <PrPage key={`${route.owner}/${route.repo}#${route.number}`} {...route} />}
      {route.kind === 'repo' && <RepoPage key={`${route.owner}/${route.repo}`.toLowerCase()} {...route} />}
      <CommandPalette />
      <Toaster />
    </>
  );
}

function ProfileRoute({ login, tab }: { login: string; tab: ProfileTab }) {
  if (tab === 'overview') return <ProfilePage login={login} />;
  if (tab === 'repositories') return <RepositoriesPage login={login} />;
  if (tab === 'achievements') return <AchievementsPage login={login} />;
  return <FollowsPage login={login} tab={tab} />;
}

/** Floating way back after the user chose "Classic" for a page. */
function ClassicPill() {
  return (
    <button
      type="button"
      onClick={leaveClassic}
      className="fixed right-5 bottom-5 z-[2147483647] flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-elevated pr-3.5 pl-2 text-[12.5px] font-medium text-fg shadow-xl shadow-black/25 transition-transform hover:scale-[1.03]"
    >
      <Logo size={22} />
      Open in Unmerged
      <ArrowUpRight className="size-3.5 text-muted" />
    </button>
  );
}
