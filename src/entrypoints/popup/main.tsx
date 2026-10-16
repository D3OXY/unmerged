import './style.css';
import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Bell, BookMarked, GitPullRequest, Home, KeyRound, ListTodo, Monitor, Moon, RotateCw, Sun, User } from 'lucide-react';
import { browser } from 'wxt/browser';
import { AuthError, rest } from '@/github/client';
import { cx } from '@/lib/cx';
import { localCache } from '@/lib/localCache';
import { isDark, NEW_TOKEN_URL, surfacesItem, themeItem, tokenItem, useStorageItem, type Surface, type Theme } from '@/lib/settings';
import { Logo } from '@/app/Logo';

const SURFACES: Record<Surface, { label: string; path: string; icon: ReactNode }> = {
  home: { label: 'Home', path: 'github.com', icon: <Home /> },
  profile: { label: 'Profiles', path: 'github.com/<user>', icon: <User /> },
  pr: { label: 'Pull requests', path: '…/pull/<number>', icon: <GitPullRequest /> },
  repo: { label: 'Repositories', path: 'github.com/<owner>/<repo>', icon: <BookMarked /> },
  work: { label: 'Pull request & issue lists', path: 'github.com/pulls, /issues', icon: <ListTodo /> },
  notifications: { label: 'Notifications', path: 'github.com/notifications', icon: <Bell /> },
};

const THEMES: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'auto', label: 'Auto', icon: <Monitor /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
];

// The popup's own copy of the theme, read before first paint so it doesn't open in the wrong one.
const themeCache = localCache<Theme>('theme');
const applyTheme = (theme: Theme) => document.documentElement.classList.toggle('dark', isDark(theme));
applyTheme(themeCache.get() ?? 'auto');

/** Toolbar popup: the connected account, theme, and which pages Unmerged takes over. */
function Popup() {
  const theme = useStorageItem(themeItem);
  const token = useStorageItem(tokenItem);
  const surfaces = useStorageItem(surfacesItem);

  useEffect(() => {
    if (!theme) return;
    themeCache.set(theme);
    applyTheme(theme);
  }, [theme]);

  const keys = Object.keys(SURFACES) as Surface[];

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo size={28} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-tight font-semibold tracking-tight">Unmerged</div>
          <div className="text-[11.5px] text-subtle">GitHub, as if it never got acquired.</div>
        </div>
        <ReloadButton />
      </header>

      <Section>{token !== null && <Account token={token} />}</Section>

      <Section title="Appearance">{theme && <ThemePicker theme={theme} />}</Section>

      <Section title="Pages" aside={surfaces && `${keys.filter((key) => surfaces[key] !== false).length} of ${keys.length} on`}>
        <div className="-mx-1.5 flex flex-col">
          {surfaces &&
            keys.map((key) => {
              const on = surfaces[key] !== false;
              const { label, path, icon } = SURFACES[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => surfacesItem.setValue({ ...surfaces, [key]: !on })}
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
            })}
        </div>
      </Section>

      <footer className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11.5px] text-subtle">
        <span>
          Press <kbd className="rounded border border-line bg-elevated px-1 font-sans text-[10.5px] text-muted">⌘K</kbd> on GitHub
        </span>
        <span className="tabular-nums">v{browser.runtime.getManifest().version}</span>
      </footer>
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

/** Who the saved token signs in as, with a form to set or replace it. */
function Account({ token }: { token: string }) {
  const [account, setAccount] = useState<AccountState>({ status: 'checking' });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!token) return;
    let current = true;
    setAccount({ status: 'checking' });
    rest<{ login: string; avatar_url: string }>('/user').then(
      (user) => current && setAccount({ status: 'connected', login: user.login, avatarUrl: user.avatar_url }),
      (error) => current && setAccount({ status: error instanceof AuthError ? 'rejected' : 'offline' }),
    );
    return () => {
      current = false;
    };
  }, [token]);

  if (!token || editing || account.status === 'rejected') {
    return (
      <TokenForm
        problem={account.status === 'rejected' && !editing ? 'GitHub rejected the saved token.' : undefined}
        onCancel={editing ? () => setEditing(false) : undefined}
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
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="h-7 cursor-pointer rounded-md border border-line px-2.5 text-[12px] font-medium text-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        Change token
      </button>
    </div>
  );
}

function TokenForm({ problem, onCancel, onSaved }: { problem?: string; onCancel?: () => void; onSaved: () => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await tokenItem.setValue(value.trim());
        onSaved();
      }}
    >
      <p className="mb-2 text-[12.5px] leading-snug text-muted">
        {problem && <span className="text-danger">{problem} </span>}
        Paste a GitHub token. It stays in this browser and is only sent to GitHub's API.
      </p>
      <div className="flex gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 transition-colors focus-within:border-accent/60">
          <KeyRound className="size-3.5 shrink-0 text-subtle" />
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
          Create a token <ArrowUpRight className="size-3" />
        </a>
        {onCancel && (
          <button type="button" onClick={onCancel} className="cursor-pointer text-subtle hover:text-fg">
            Cancel
          </button>
        )}
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

/** Only for unpacked installs: re-reads the extension from disk after a `pnpm build`. Open GitHub tabs need a refresh. */
function ReloadButton() {
  const [unpacked, setUnpacked] = useState(false);
  useEffect(() => {
    browser.management.getSelf().then((self) => setUnpacked(self.installType === 'development'));
  }, []);
  if (!unpacked) return null;
  return (
    <button
      type="button"
      onClick={() => browser.runtime.reload()}
      title="Reload extension"
      aria-label="Reload extension"
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-fg"
    >
      <RotateCw className="size-3.5" />
    </button>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
