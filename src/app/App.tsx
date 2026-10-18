import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon, Cancel01Icon, Clock01Icon, SquareLock02Icon } from '@hugeicons/core-free-icons';
import { tokenItem, useStorageItem } from '@/lib/settings';
import { leaveClassic } from '@/lib/classic';
import type { ProfileTab } from '@/lib/routes';
import { formatTime } from '@/lib/time';
import { ActionsPage } from '@/pages/actions/ActionsPage';
import { RunPage } from '@/pages/actions/RunPage';
import { BranchesPage } from '@/pages/branches/BranchesPage';
import { ContributorsPage } from '@/pages/contributors/ContributorsPage';
import { CommitPage } from '@/pages/commit/CommitPage';
import { ComparePage } from '@/pages/compare/ComparePage';
import { HomePage } from '@/pages/home/HomePage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { OrgListPage } from '@/pages/org/OrgListPage';
import { OwnerPage } from '@/pages/org/OrgPage';
import { AchievementsPage } from '@/pages/profile/AchievementsPage';
import { FollowsPage } from '@/pages/profile/FollowsPage';
import { RepositoriesPage } from '@/pages/profile/RepositoriesPage';
import { IssuePage } from '@/pages/issue/IssuePage';
import { NewIssuePage } from '@/pages/issue/NewIssuePage';
import { PrPage } from '@/pages/pr/PrPage';
import { ReleasePage } from '@/pages/releases/ReleasePage';
import { ReleasesPage } from '@/pages/releases/ReleasesPage';
import { RepoListPage } from '@/pages/repo/RepoListPage';
import { RepoPage } from '@/pages/repo/RepoPage';
import { SearchPage } from '@/pages/search/SearchPage';
import { WorkListPage } from '@/pages/work/WorkListPage';
import { MediaViewer } from '@/ui/MediaViewer';
import { Toaster } from '@/ui/toast';
import { CommandPalette } from './CommandPalette';
import { SettingsDialog } from './SettingsDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { Logo } from './Logo';
import { appState, authRejected, githubBlock } from './state';
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
      {route.kind === 'work' && <WorkListPage key={`${route.type}/${route.filter}`} type={route.type} filter={route.filter} peek={route.peek} />}
      {route.kind === 'notifications' && <NotificationsPage />}
      {route.kind === 'search' && <SearchPage key={route.q} {...route} />}
      {route.kind === 'profile' && <ProfileRoute key={route.login} login={route.login} tab={route.tab} />}
      {route.kind === 'org' && <OrgListPage key={route.login.toLowerCase()} login={route.login} tab={route.tab} />}
      {route.kind === 'pr' && <PrPage key={`${route.owner}/${route.repo}#${route.number}`} {...route} />}
      {route.kind === 'issue' && <IssuePage key={`${route.owner}/${route.repo}#${route.number}`} {...route} />}
      {route.kind === 'newIssue' && <NewIssuePage key={`${route.owner}/${route.repo}/new/${route.choose}${route.search}`.toLowerCase()} {...route} />}
      {route.kind === 'commit' && <CommitPage key={`${route.owner}/${route.repo}@${route.sha}`.toLowerCase()} {...route} />}
      {route.kind === 'branches' && <BranchesPage key={`${route.owner}/${route.repo}/${route.tab}`.toLowerCase()} {...route} />}
      {route.kind === 'contributors' && <ContributorsPage key={`${route.owner}/${route.repo}`.toLowerCase()} {...route} />}
      {route.kind === 'actions' && <ActionsPage key={`${route.owner}/${route.repo}/${route.workflow ?? ''}`.toLowerCase()} {...route} />}
      {route.kind === 'run' && <RunPage key={`${route.owner}/${route.repo}/${route.runId}/${route.attempt ?? ''}`.toLowerCase()} {...route} />}
      {route.kind === 'releases' && <ReleasesPage key={`${route.owner}/${route.repo}/${route.tab}`.toLowerCase()} {...route} />}
      {route.kind === 'release' && <ReleasePage key={`${route.owner}/${route.repo}/${route.tag ?? ''}`.toLowerCase()} {...route} />}
      {route.kind === 'compare' && <ComparePage key={`${route.owner}/${route.repo}`.toLowerCase()} {...route} />}
      {route.kind === 'repo' &&
        (route.view === 'issues' || route.view === 'pulls' ? (
          <RepoListPage key={`${route.owner}/${route.repo}/${route.view}`.toLowerCase()} owner={route.owner} repo={route.repo} tab={route.view} peek={route.peek} />
        ) : (
          <RepoPage key={`${route.owner}/${route.repo}`.toLowerCase()} {...route} view={route.view} />
        ))}
      <CommandPalette />
      <SettingsDialog />
      <ShortcutsDialog />
      <MediaViewer />
      <Toaster />
      <GitHubBanner />
    </>
  );
}

/** Says why pages stopped loading: the token's rate limit (until it resets) or an organization's SAML SSO. */
function GitHubBanner() {
  const block = githubBlock.use();
  if (!block) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex max-w-lg -translate-x-1/2 animate-pop items-center gap-2.5 rounded-xl border border-line-strong bg-elevated py-2 pr-2 pl-3.5 text-[13px] shadow-2xl shadow-black/30"
    >
      <HugeiconsIcon icon={block.kind === 'rate-limit' ? Clock01Icon : SquareLock02Icon} className="size-4 shrink-0 text-warning" />
      {block.kind === 'rate-limit' ? (
        <span className="py-1 pr-1.5">GitHub's rate limit for your token is used up. Unmerged pauses until {formatTime(block.resetAt)}.</span>
      ) : (
        <>
          <span>An organization requires SAML SSO for your token.</span>
          <a
            // Without GitHub's link, a classic token's "Configure SSO" lives on the tokens page.
            href={block.authorizeUrl ?? 'https://github.com/settings/tokens'}
            target="_blank"
            rel="noreferrer"
            className="font-medium whitespace-nowrap text-accent hover:underline"
          >
            Authorize SSO
          </a>
          <button
            type="button"
            onClick={() => githubBlock.set(null)}
            aria-label="Dismiss"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

function ProfileRoute({ login, tab }: { login: string; tab: ProfileTab }) {
  if (tab === 'overview') return <OwnerPage login={login} />;
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
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5 text-muted" />
    </button>
  );
}
