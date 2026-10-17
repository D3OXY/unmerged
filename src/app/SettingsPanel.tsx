import { useEffect, useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon, Book02Icon, CheckListIcon, CircleDotIcon, ComputerIcon, GitCommitHorizontalIcon, GitCompareIcon, GitPullRequestIcon, Home01Icon, Key01Icon, LayoutRightIcon, Moon02Icon, Notification03Icon, PlayIcon, Search01Icon, Sun03Icon, UserIcon } from '@hugeicons/core-free-icons';
import { GitHubError, rest } from '@/github/client';
import { cx } from '@/lib/cx';
import { saveToken } from '@/lib/persist';
import { NEW_TOKEN_URL, openSettingsPage, sidePanelItem, surfacesItem, themeItem, tokenItem, useStorageItem, type Surface, type Theme } from '@/lib/settings';

const SURFACES: Record<Surface, { label: string; path: string; icon: ReactNode }> = {
  home: { label: 'Home', path: 'github.com', icon: <HugeiconsIcon icon={Home01Icon} /> },
  profile: { label: 'Profiles & organizations', path: 'github.com/<user>, /<org>', icon: <HugeiconsIcon icon={UserIcon} /> },
  pr: { label: 'Pull requests', path: '…/pull/<number>', icon: <HugeiconsIcon icon={GitPullRequestIcon} /> },
  issue: { label: 'Issues', path: '…/issues/<number>, …/issues/new', icon: <HugeiconsIcon icon={CircleDotIcon} /> },
  commit: { label: 'Commits', path: '…/commit/<sha>, …/pull/<number>/commits/<sha>', icon: <HugeiconsIcon icon={GitCommitHorizontalIcon} /> },
  compare: { label: 'Compare & new pull request', path: '…/compare/<base>...<head>', icon: <HugeiconsIcon icon={GitCompareIcon} /> },
  repo: { label: 'Repositories', path: 'github.com/<owner>/<repo>, /issues, /pulls', icon: <HugeiconsIcon icon={Book02Icon} /> },
  work: { label: 'Pull request & issue lists', path: 'github.com/pulls, /issues', icon: <HugeiconsIcon icon={CheckListIcon} /> },
  notifications: { label: 'Notifications', path: 'github.com/notifications', icon: <HugeiconsIcon icon={Notification03Icon} /> },
  run: { label: 'Workflow runs', path: '…/actions/runs/<id>, …/job/<id>', icon: <HugeiconsIcon icon={PlayIcon} /> },
  search: { label: 'Search', path: 'github.com/search, …/<repo>/search', icon: <HugeiconsIcon icon={Search01Icon} /> },
};

const THEMES: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'auto', label: 'Auto', icon: <HugeiconsIcon icon={ComputerIcon} /> },
  { value: 'light', label: 'Light', icon: <HugeiconsIcon icon={Sun03Icon} /> },
  { value: 'dark', label: 'Dark', icon: <HugeiconsIcon icon={Moon02Icon} /> },
];

/**
 * Unmerged's settings: the connected account, theme, and which pages it takes over. Shown in the toolbar
 * popup (and the options page, its copy in a tab) and in the in-page Settings dialog; every change applies to
 * open tabs at once. The token itself is only ever typed into the extension's pages, not into github.com.
 */
export function SettingsPanel() {
  const theme = useStorageItem(themeItem);
  const token = useStorageItem(tokenItem);
  const surfaces = useStorageItem(surfacesItem);
  const sidePanel = useStorageItem(sidePanelItem);
  const keys = Object.keys(SURFACES) as Surface[];

  return (
    <>
    <Section>{token !== null && <Account token={token} />}</Section>

    <Section title="Appearance">{theme && <ThemePicker theme={theme} />}</Section>

    <Section title="Lists">
      <div className="-mx-1.5 flex flex-col">
        {sidePanel !== null && (
          <ToggleRow
            on={sidePanel}
            onClick={() => sidePanelItem.setValue(!sidePanel)}
            icon={<HugeiconsIcon icon={LayoutRightIcon} />}
            label="Open in a side panel"
            path="Issues and pull requests open beside the list"
          />
        )}
      </div>
    </Section>

    <Section title="Pages" aside={surfaces && `${keys.filter((key) => surfaces[key] !== false).length} of ${keys.length} on`}>
      <div className="-mx-1.5 flex flex-col">
        {surfaces &&
          keys.map((key) => {
            const on = surfaces[key] !== false;
            return <ToggleRow key={key} on={on} onClick={() => surfacesItem.setValue({ ...surfaces, [key]: !on })} {...SURFACES[key]} />;
          })}
      </div>
    </Section>
    </>
  );
}

/** A setting that's on or off: icon, label and a detail line, with a switch. */
function ToggleRow({ on, onClick, icon, label, path }: { on: boolean; onClick: () => void; icon: ReactNode; label: string; path: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex h-11 cursor-pointer items-center gap-3 rounded-lg px-1.5 text-left transition-colors hover:bg-hover"
    >
      <span
        className={cx(
          'flex size-7 shrink-0 items-center justify-center rounded-md border border-line transition-colors [&>svg]:size-3.5',
          on ? 'bg-elevated text-fg' : 'text-subtle',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[13px] font-medium transition-colors', !on && 'text-muted')}>{label}</span>
        <span className="block truncate font-mono text-[10.5px] text-subtle">{path}</span>
      </span>
      <Switch on={on} />
    </button>
  );
}

function Section({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3">
      {title && (
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-subtle">
          {title}
          {aside && <span className="font-normal tabular-nums">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

type AccountState =
  | { status: 'checking' }
  | { status: 'connected'; login: string; avatarUrl: string }
  | { status: 'rejected' }
  | { status: 'offline' };

const STATUS_LINE: Record<Exclude<AccountState['status'], 'rejected'>, { text: string; dot: string }> = {
  checking: { text: 'Checking token…', dot: 'bg-subtle' },
  connected: { text: 'Connected to GitHub', dot: 'bg-success' },
  offline: { text: "Couldn't reach GitHub", dot: 'bg-warning' },
};

// The in-page Settings dialog sends token changes to the extension's settings page instead.
const onGitHub = location.hostname === 'github.com';

/** Who the saved token signs in as, with a form to set, replace or remove it (outside github.com). */
function Account({ token }: { token: string }) {
  const [account, setAccount] = useState<AccountState>({ status: 'checking' });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!token) return;
    let current = true;
    setAccount({ status: 'checking' });
    rest<{ login: string; avatar_url: string }>('/user').then(
      (user) => current && setAccount({ status: 'connected', login: user.login, avatarUrl: user.avatar_url }),
      (error) => current && setAccount({ status: error instanceof GitHubError && error.problem.kind === 'auth' ? 'rejected' : 'offline' }),
    );
    return () => {
      current = false;
    };
  }, [token]);

  const rejected = !!token && account.status === 'rejected';
  if (onGitHub && (!token || rejected)) {
    return (
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted">
          {rejected ? <span className="text-danger">GitHub rejected the saved token.</span> : 'No GitHub token yet.'} Tokens are added in
          Unmerged's settings.
        </p>
        <SmallButton onClick={openSettingsPage}>Open settings</SmallButton>
      </div>
    );
  }
  if (!token || editing || account.status === 'rejected') {
    return (
      <TokenForm
        problem={rejected && !editing ? 'GitHub rejected the saved token.' : undefined}
        onCancel={editing ? () => setEditing(false) : undefined}
        onDisconnect={token ? () => saveToken('') : undefined}
        onSaved={() => setEditing(false)}
      />
    );
  }

  const line = STATUS_LINE[account.status];
  return (
    <div className="flex items-center gap-3">
      {account.status === 'connected' ? (
        <img src={`${account.avatarUrl}&s=64`} alt="" className="size-8 rounded-full ring-1 ring-line" />
      ) : (
        <span className={cx('size-8 rounded-full bg-elevated', account.status === 'checking' && 'animate-shimmer')} />
      )}
      <div className="min-w-0 flex-1">
        {account.status === 'connected' ? (
          <div className="truncate text-[13px] font-medium">{account.login}</div>
        ) : account.status === 'offline' ? (
          <div className="text-[13px] font-medium">Token saved</div>
        ) : (
          <div className="my-1 h-3 w-20 animate-shimmer rounded bg-elevated" />
        )}
        <div className="flex items-center gap-1.5 text-[11.5px] text-subtle">
          <span className={cx('size-1.5 rounded-full', line.dot)} />
          {line.text}
        </div>
      </div>
      <SmallButton onClick={onGitHub ? openSettingsPage : () => setEditing(true)}>Change token</SmallButton>
    </div>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 shrink-0 cursor-pointer rounded-md border border-line px-2.5 text-[12px] font-medium text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {children}
    </button>
  );
}

/** Saving a token, or disconnecting, also drops everything cached for the previous one (see `saveToken`). */
function TokenForm({ problem, onCancel, onDisconnect, onSaved }: { problem?: string; onCancel?: () => void; onDisconnect?: () => void; onSaved: () => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await saveToken(value.trim());
        onSaved();
      }}
    >
      <p className="mb-2 text-[12.5px] leading-snug text-muted">
        {problem && <span className="text-danger">{problem} </span>}
        Paste a GitHub token. It's kept in the extension's storage and sent only to api.github.com.
      </p>
      <div className="flex gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 transition-colors focus-within:border-accent/60">
          <HugeiconsIcon icon={Key01Icon} className="size-3.5 shrink-0 text-subtle" />
          <input
            autoFocus
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
            placeholder="ghp_… or github_pat_…"
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-subtle"
          />
        </label>
        <button
          type="submit"
          disabled={!value.trim()}
          className="h-8 cursor-pointer rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-accent hover:underline">
          Create a token <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
        </a>
        <span className="flex items-center gap-3">
          {onDisconnect && (
            <button type="button" onClick={onDisconnect} className="cursor-pointer text-subtle hover:text-danger">
              Disconnect
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} className="cursor-pointer text-subtle hover:text-fg">
              Cancel
            </button>
          )}
        </span>
      </div>
    </form>
  );
}

/** Segmented control; the highlight slides between options. */
function ThemePicker({ theme }: { theme: Theme }) {
  const index = THEMES.findIndex((t) => t.value === theme);
  return (
    <div role="radiogroup" aria-label="Theme" className="relative grid grid-cols-3 rounded-lg border border-line bg-bg p-0.5">
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-md border border-line bg-elevated shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {THEMES.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => themeItem.setValue(value)}
          className={cx(
            'relative flex h-7 cursor-pointer items-center justify-center gap-1.5 text-[12.5px] font-medium transition-colors [&>svg]:size-3.5',
            theme === value ? 'text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={cx('relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-line-strong')}>
      <span
        className={cx(
          'absolute top-[2px] left-[2px] size-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none',
          on && 'translate-x-3',
        )}
      />
    </span>
  );
}
