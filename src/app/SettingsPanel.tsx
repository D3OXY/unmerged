import { useEffect, useState, type ReactNode } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Analytics01Icon, ArrowUpRight01Icon, Book02Icon, Building03Icon, CheckListIcon, CircleDotIcon, ComputerIcon, DashboardSquare01Icon, FilterIcon, GitCommitHorizontalIcon, GitCompareIcon, GitMergeIcon, GitPullRequestIcon, HierarchyIcon, Home01Icon, Key01Icon, Layout2ColumnIcon, LayoutRightIcon, Mail01Icon, Moon02Icon, Notification03Icon, PaintBoardIcon, PlayIcon, Search01Icon, Settings02Icon, SquareLock02Icon, Sun03Icon, UserIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { GitHubError, rest } from '@/github/client';
import { cx } from '@/lib/cx';
import { saveToken } from '@/lib/persist';
import { appearanceItem, customThemesItem, DEFAULT_PRIVACY, fontItem, issueSplitItem, keepFileFiltersItem, nestIssuesItem, NEW_TOKEN_URL, openSettingsPage, privacyItem, repoOverviewItem, repoPulseItem, sidePanelItem, slideToMergeItem, surfacesItem, themeIdItem, TOKEN_HELP_URL, tokenItem, useStorageItem, type Appearance, type Blur, type Font, type KeepFileFilters, type Surface } from '@/lib/settings';
import { Switch } from '@/ui/Switch';
import { ThemePicker } from './ThemePicker';

const SURFACES: Record<Surface, { label: string; path: string; icon: ReactNode }> = {
  home: { label: 'Home', path: 'github.com', icon: <HugeiconsIcon icon={Home01Icon} /> },
  profile: { label: 'Profiles & organizations', path: 'github.com/<user>, /<org>', icon: <HugeiconsIcon icon={UserIcon} /> },
  pr: { label: 'Pull requests', path: '…/pull/<number>', icon: <HugeiconsIcon icon={GitPullRequestIcon} /> },
  issue: { label: 'Issues', path: '…/issues/<number>, …/issues/new', icon: <HugeiconsIcon icon={CircleDotIcon} /> },
  commit: { label: 'Commits', path: '…/commit/<sha>, …/pull/<number>/commits/<sha>', icon: <HugeiconsIcon icon={GitCommitHorizontalIcon} /> },
  compare: { label: 'Compare & new pull request', path: '…/compare/<base>...<head>', icon: <HugeiconsIcon icon={GitCompareIcon} /> },
  repo: { label: 'Repositories', path: 'github.com/<owner>/<repo>, /issues, /pulls, /branches, /releases, /tags, /graphs/contributors', icon: <HugeiconsIcon icon={Book02Icon} /> },
  work: { label: 'Pull request & issue lists', path: 'github.com/pulls, /issues', icon: <HugeiconsIcon icon={CheckListIcon} /> },
  notifications: { label: 'Notifications', path: 'github.com/notifications', icon: <HugeiconsIcon icon={Notification03Icon} /> },
  run: { label: 'Actions', path: '…/actions, …/actions/runs/<id>, …/job/<id>', icon: <HugeiconsIcon icon={PlayIcon} /> },
  search: { label: 'Search', path: 'github.com/search, …/<repo>/search', icon: <HugeiconsIcon icon={Search01Icon} /> },
};

const BLURS: Record<Blur, { label: string; path: string; icon: ReactNode }> = {
  orgs: { label: 'Organizations', path: 'Names and logos in the sidebar and on profiles', icon: <HugeiconsIcon icon={Building03Icon} /> },
  repos: { label: 'Private repository names', path: 'Sidebar, lists, notifications and page headers', icon: <HugeiconsIcon icon={SquareLock02Icon} /> },
  commits: { label: 'Commit messages', path: 'In private repositories', icon: <HugeiconsIcon icon={GitCommitHorizontalIcon} /> },
  titles: { label: 'Pull request & issue titles', path: 'In private repositories: lists, notifications and pages', icon: <HugeiconsIcon icon={GitPullRequestIcon} /> },
  emails: { label: 'Email addresses', path: 'On organization profiles', icon: <HugeiconsIcon icon={Mail01Icon} /> },
};

const APPEARANCES: { value: Appearance; label: string; icon: ReactNode }[] = [
  { value: 'auto', label: 'Auto', icon: <HugeiconsIcon icon={ComputerIcon} /> },
  { value: 'light', label: 'Light', icon: <HugeiconsIcon icon={Sun03Icon} /> },
  { value: 'dark', label: 'Dark', icon: <HugeiconsIcon icon={Moon02Icon} /> },
];

const FONTS: { value: Font; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];

const KEEP_FILE_FILTERS: { value: KeepFileFilters; label: string; detail: string }[] = [
  { value: 'off', label: 'Off', detail: 'A reload clears the Files changed filters' },
  { value: 'url', label: 'URL', detail: "The filters stay in the page's URL, also in links you share" },
  { value: 'all', label: 'Everywhere', detail: 'Your last filters apply to all pull requests' },
];

export type SettingsPage = 'general' | 'appearance' | 'pages' | 'privacy';

const PAGES: { id: SettingsPage; label: string; icon: IconSvgElement }[] = [
  { id: 'general', label: 'General', icon: Settings02Icon },
  { id: 'appearance', label: 'Appearance', icon: PaintBoardIcon },
  { id: 'pages', label: 'Pages', icon: DashboardSquare01Icon },
  { id: 'privacy', label: 'Privacy', icon: ViewOffSlashIcon },
];

/**
 * Unmerged's settings, on four pages: General (the connected account, lists), Appearance (mode, theme, font),
 * Pages (which pages it takes over) and Privacy (what it blurs). Shown in the toolbar popup (and the options
 * page, its copy in a tab) and in the in-page Settings dialog; every change applies to open tabs at once.
 * Narrow, the pages are tabs along the top; wide, a list down the side. The token itself is only ever typed into the extension's pages,
 * not into github.com. `onClose` closes the in-page dialog when it sends the user to the settings page for that.
 */
export function SettingsPanel({ initialPage = 'general', onClose }: { initialPage?: SettingsPage; onClose?: () => void }) {
  const [page, setPage] = useState(initialPage);

  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col @lg:flex-row">
        <nav
          role="tablist"
          aria-label="Settings"
          className="flex shrink-0 gap-1 border-t border-line px-3 py-2 @lg:w-44 @lg:flex-col @lg:border-r @lg:px-2"
        >
          {PAGES.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={page === id}
              onClick={() => setPage(id)}
              className={cx(
                // Narrow, four labels only just fit: the icons go and each tab is as wide as its label.
                'flex h-8 flex-auto cursor-pointer items-center justify-center gap-2 rounded-md px-2.5 text-[12.5px] font-medium transition-colors @lg:flex-none @lg:justify-start [&>svg]:size-3.5 @max-lg:[&>svg]:hidden',
                page === id ? 'bg-line text-fg' : 'text-muted hover:bg-hover hover:text-fg',
              )}
            >
              <HugeiconsIcon icon={icon} />
              {label}
            </button>
          ))}
        </nav>
        <div role="tabpanel" aria-label={PAGES.find((p) => p.id === page)?.label} className="@container min-h-0 flex-1 overflow-y-auto">
          {page === 'general' ? <GeneralPage onClose={onClose} /> : page === 'appearance' ? <AppearancePage /> : page === 'pages' ? <PagesPage /> : <PrivacyPage />}
        </div>
      </div>
    </div>
  );
}

function GeneralPage({ onClose }: { onClose?: () => void }) {
  const token = useStorageItem(tokenItem);
  const sidePanel = useStorageItem(sidePanelItem);
  const issueSplit = useStorageItem(issueSplitItem);
  const nestIssues = useStorageItem(nestIssuesItem);
  const repoPulse = useStorageItem(repoPulseItem);
  const repoOverview = useStorageItem(repoOverviewItem);
  const slideToMerge = useStorageItem(slideToMergeItem);
  const keepFileFilters = useStorageItem(keepFileFiltersItem);

  return (
    <>
      <Section title="Account">{token !== null && <Account token={token} onClose={onClose} />}</Section>
      <Section title="Lists">
        <div className="-mx-1.5 flex flex-col">
          {sidePanel !== null && (
            <ToggleRow
              on={sidePanel}
              onClick={() => sidePanelItem.setValue(!sidePanel)}
              icon={<HugeiconsIcon icon={LayoutRightIcon} />}
              label="Open in a side panel"
              path="Pull requests and issues open beside the list"
            />
          )}
          {issueSplit !== null && (
            <ToggleRow
              on={issueSplit}
              onClick={() => issueSplitItem.setValue(!issueSplit)}
              icon={<HugeiconsIcon icon={Layout2ColumnIcon} />}
              label="Split issue lists"
              path="A compact list with the open issue beside it, on a wide window"
            />
          )}
          {nestIssues !== null && (
            <ToggleRow
              on={nestIssues}
              onClick={() => nestIssuesItem.setValue(!nestIssues)}
              icon={<HugeiconsIcon icon={HierarchyIcon} />}
              label="Nest sub-issues"
              path="Issue lists show sub-issues under their parent, in GitHub's order"
            />
          )}
        </div>
      </Section>
      <Section title="Pull requests">
        <div className="-mx-1.5 flex flex-col">
          {slideToMerge !== null && (
            <ToggleRow
              on={slideToMerge}
              onClick={() => slideToMergeItem.setValue(!slideToMerge)}
              icon={<HugeiconsIcon icon={GitMergeIcon} />}
              label="Slide to merge"
              path="A slider in the bottom-right corner merges a ready pull request from any tab"
            />
          )}
          {keepFileFilters !== null && (
            <ChoiceRow
              value={keepFileFilters}
              options={KEEP_FILE_FILTERS}
              onChange={(value) => keepFileFiltersItem.setValue(value)}
              icon={<HugeiconsIcon icon={FilterIcon} />}
              label="Keep file filters"
            />
          )}
        </div>
      </Section>
      <Section title="Repositories">
        <div className="-mx-1.5 flex flex-col">
          {repoOverview !== null && (
            <ToggleRow
              on={repoOverview}
              onClick={() => repoOverviewItem.setValue(!repoOverview)}
              icon={<HugeiconsIcon icon={Book02Icon} />}
              label="Overview tab"
              path="The front page shows the README; the files move to a Files tab"
            />
          )}
          {repoPulse !== null && (
            <ToggleRow
              on={repoPulse}
              onClick={() => repoPulseItem.setValue(!repoPulse)}
              icon={<HugeiconsIcon icon={Analytics01Icon} />}
              label="Show activity"
              path="The last 12 weeks on the front page: commits, pull requests, issues, CI and release"
            />
          )}
        </div>
      </Section>
    </>
  );
}

function AppearancePage() {
  const appearance = useStorageItem(appearanceItem);
  const themeId = useStorageItem(themeIdItem);
  const custom = useStorageItem(customThemesItem);
  const font = useStorageItem(fontItem);

  return (
    <>
      <Section title="Mode">{appearance && <AppearancePicker appearance={appearance} />}</Section>
      <Section title="Theme">{themeId !== null && custom && <ThemePicker themeId={themeId} custom={custom} />}</Section>
      <Section title="Font">{font && <FontPicker font={font} />}</Section>
    </>
  );
}

function PagesPage() {
  const surfaces = useStorageItem(surfacesItem);
  const keys = Object.keys(SURFACES) as Surface[];

  return (
    <Section title="Pages Unmerged takes over" aside={surfaces && `${keys.filter((key) => surfaces[key] !== false).length} of ${keys.length} on`}>
      <div className="-mx-1.5 flex flex-col">
        {surfaces &&
          keys.map((key) => {
            const on = surfaces[key] !== false;
            return <ToggleRow key={key} on={on} onClick={() => surfacesItem.setValue({ ...surfaces, [key]: !on })} {...SURFACES[key]} />;
          })}
      </div>
    </Section>
  );
}

/** The master switch, then a switch per kind of detail; the kinds stay as set while the master is off. */
function PrivacyPage() {
  const privacy = useStorageItem(privacyItem);
  if (!privacy) return null;
  const keys = Object.keys(BLURS) as Blur[];
  // A kind added after the setting was saved takes its default, as in `blurredKinds`.
  const blur = { ...DEFAULT_PRIVACY.blur, ...privacy.blur };

  return (
    <>
      <Section title="Privacy">
        <div className="-mx-1.5 flex flex-col">
          <ToggleRow
            on={privacy.on}
            onClick={() => privacyItem.setValue({ ...privacy, on: !privacy.on })}
            icon={<HugeiconsIcon icon={ViewOffSlashIcon} />}
            label="Blur private details"
            path="For screen sharing. Hover a detail to show it"
          />
        </div>
      </Section>
      <Section title="Blur" aside={`${keys.filter((key) => blur[key]).length} of ${keys.length} on`}>
        <div className="-mx-1.5 flex flex-col">
          {keys.map((key) => (
            <ToggleRow key={key} on={blur[key]} disabled={!privacy.on} onClick={() => privacyItem.setValue({ ...privacy, blur: { ...blur, [key]: !blur[key] } })} {...BLURS[key]} />
          ))}
        </div>
      </Section>
    </>
  );
}

/** A setting that's on or off: icon, label and a detail line, with a switch. */
function ToggleRow({ on, disabled, onClick, icon, label, path }: { on: boolean; disabled?: boolean; onClick: () => void; icon: ReactNode; label: string; path: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className="group flex h-11 cursor-pointer items-center gap-3 rounded-lg px-1.5 text-left transition-[background-color,opacity] hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
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

/** A setting with a few named values: icon, label and the chosen value's detail line, with a segmented control. */
function ChoiceRow<T extends string>({ value, options, onChange, icon, label }: {
  value: T;
  options: { value: T; label: string; detail: string }[];
  onChange: (value: T) => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 px-1.5 py-1.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-elevated text-fg [&>svg]:size-3.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block font-mono text-[10.5px] text-subtle">{options.find((o) => o.value === value)?.detail}</span>
      </span>
      <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-lg border border-line bg-bg p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cx('h-6 cursor-pointer rounded-md px-2 text-[12px]', value === option.value ? 'bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg')}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
// The settings page that github.com opened for a token change (see openSettingsPage): it closes once that's done.
const forToken = !onGitHub && location.hash === '#token';

/** Closes the settings page's tab, so the browser shows the GitHub tab that opened it again. */
async function closeTab() {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
}

/** Who the saved token signs in as, with a form to set, replace or remove it (outside github.com). */
function Account({ token, onClose }: { token: string; onClose?: () => void }) {
  const [account, setAccount] = useState<AccountState>({ status: 'checking' });
  const [editing, setEditing] = useState(forToken);
  const done = forToken ? closeTab : () => setEditing(false);
  const toSettingsPage = () => {
    openSettingsPage();
    onClose?.();
  };

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
        <SmallButton onClick={toSettingsPage}>Open settings</SmallButton>
      </div>
    );
  }
  if (!token || editing || account.status === 'rejected') {
    return (
      <TokenForm
        problem={rejected && !editing ? 'GitHub rejected the saved token.' : undefined}
        onCancel={editing ? done : undefined}
        onDisconnect={token ? () => saveToken('') : undefined}
        onSaved={done}
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
      <SmallButton onClick={onGitHub ? toSettingsPage : () => setEditing(true)}>Change token</SmallButton>
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
        Paste a GitHub token. It's kept in the extension's storage and sent only to api.github.com.{' '}
        <a href={TOKEN_HELP_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          Why a token?
        </a>
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
function AppearancePicker({ appearance }: { appearance: Appearance }) {
  const index = APPEARANCES.findIndex((a) => a.value === appearance);
  return (
    <div role="radiogroup" aria-label="Mode" className="relative grid grid-cols-3 rounded-lg border border-line bg-bg p-0.5">
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-md border border-line bg-elevated shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {APPEARANCES.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={appearance === value}
          onClick={() => appearanceItem.setValue(value)}
          className={cx(
            'relative flex h-7 cursor-pointer items-center justify-center gap-1.5 text-[12.5px] font-medium transition-colors [&>svg]:size-3.5',
            appearance === value ? 'text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Notion's font picker: each option shows "Ag" in its own font. */
function FontPicker({ font }: { font: Font }) {
  return (
    <div role="radiogroup" aria-label="Font" className="grid grid-cols-3 gap-2">
      {FONTS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={font === value}
          onClick={() => fontItem.setValue(value)}
          className={cx(
            'flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border py-2 transition-colors',
            font === value ? 'border-accent/60 bg-accent/10 text-fg' : 'border-line text-muted hover:bg-hover hover:text-fg',
          )}
        >
          <span data-font={value} className="font-sans text-[22px] leading-tight">
            Ag
          </span>
          <span className="text-[11.5px] font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
