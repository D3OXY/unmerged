import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { tokenItem } from '@/lib/settings';
import { leaveClassic } from '@/lib/classic';
import { HomePage } from '@/pages/home/HomePage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { PrPage } from '@/pages/pr/PrPage';
import { RepoPage } from '@/pages/repo/RepoPage';
import { Toaster } from '@/ui/toast';
import { CommandPalette } from './CommandPalette';
import { Logo } from './Logo';
import { appState, authRejected } from './state';
import { TokenGate } from './TokenGate';

function useToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    tokenItem.getValue().then(setToken);
    return tokenItem.watch(setToken);
  }, []);
  return token;
}

export function App() {
  const state = appState.use();
  const token = useToken();
  const rejected = authRejected.use();

  if (state.mode === 'classic') return <ClassicPill />;
  if (token === null) return null;
  if (!token || rejected) return <TokenGate rejected={rejected} />;

  const { route } = state;
  return (
    <>
      {route.kind === 'home' && <HomePage />}
      {route.kind === 'profile' && <ProfilePage key={route.login} login={route.login} />}
      {route.kind === 'pr' && <PrPage key={`${route.owner}/${route.repo}#${route.number}`} {...route} />}
      {route.kind === 'repo' && <RepoPage key={`${route.owner}/${route.repo}`.toLowerCase()} {...route} />}
      <CommandPalette />
      <Toaster />
    </>
  );
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
