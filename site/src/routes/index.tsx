import { useEffect, useState, type ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  BrowserIcon,
  CircleDotIcon,
  CodeIcon,
  ComputerTerminal01Icon,
  Copy01Icon,
  CursorPointer01Icon,
  DatabaseIcon,
  FileDiffIcon,
  GithubIcon,
  GitPullRequestIcon,
  Home01Icon,
  Key01Icon,
  Notification03Icon,
  Search01Icon,
  StopCircleIcon,
  Tick02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { ProductShot } from '../components/ProductShot';
import { Kbd, Logo } from '../components/ui';
import { REPO_URL, TAGLINE, TOKEN_URL } from '../site';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <div className="relative overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--u-accent)_22%,transparent),transparent_70%)]"
      />
      <Nav />
      <main className="relative">
        <Hero />
        <Stats />
        <Pages />
        <Speed />
        <Keyboard />
        <Privacy />
        <Install />
      </main>
      <Footer />
    </div>
  );
}

const NAV_LINKS = [
  { href: '#pages', label: 'Pages' },
  { href: '#speed', label: 'Speed' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#install', label: 'Install' },
];

/** Floating liquid-glass bar; it narrows and shortens while scrolling down and expands again on the way up. */
function Nav() {
  const [compact, setCompact] = useCompactOnScroll();
  return (
    <header
      data-compact={compact || undefined}
      // Keyboard focus always gets the full bar.
      onFocus={() => setCompact(false)}
      className="group pointer-events-none sticky top-0 z-50 flex h-16 justify-center px-3 pt-3"
    >
      <div className="glass pointer-events-auto flex h-[52px] w-[min(1120px,100%)] items-center rounded-full pr-2 pl-3.5 transition-[width,height,padding] duration-500 ease-spring group-data-compact:h-11 group-data-compact:w-[min(500px,100%)] group-data-compact:pr-1.5 group-data-compact:pl-3 sm:pl-5">
        <a href="/" aria-label="Unmerged" className="flex shrink-0 items-center gap-2">
          <Logo size={24} />
          <span className="hidden text-[15px] font-semibold tracking-tight min-[400px]:inline">Unmerged</span>
        </a>
        <nav className="ml-auto flex items-center text-[13px] text-muted sm:text-[13.5px]">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-1.5 py-1.5 transition-colors min-[360px]:px-2 hover:bg-white/[0.06] hover:text-fg sm:px-3"
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          href={REPO_URL}
          aria-label="GitHub"
          className="ml-1 flex h-9 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 text-[13px] font-medium transition-[background-color,height,padding] duration-500 ease-spring hover:bg-white/[0.12] group-data-compact:h-8 group-data-compact:px-[7px] sm:ml-2"
        >
          <HugeiconsIcon icon={GithubIcon} className="size-4 shrink-0" />
          {/* The label folds away in the compact bar and on phones; the icon carries it there. */}
          <span className="hidden max-w-16 overflow-hidden pl-2 whitespace-nowrap opacity-100 transition-[max-width,padding,opacity] duration-500 ease-spring group-data-compact:max-w-0 group-data-compact:pl-0 group-data-compact:opacity-0 sm:inline">
            GitHub
          </span>
        </a>
      </div>
    </header>
  );
}

/** Pixels of scrolling in one direction before the nav changes size, so jitter and trackpad noise don't flip it. */
const SCROLL_SLACK = 6;

/**
 * True while the reader is scrolling down past the top of the page; a slight scroll back up, or reaching the
 * top, clears it. Small moves accumulate against the last position that changed the state.
 */
function useCompactOnScroll() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let anchor = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Clamped so iOS rubber-banding past either end doesn't read as a direction change.
      const y = Math.min(Math.max(window.scrollY, 0), document.documentElement.scrollHeight - window.innerHeight);
      if (y < 24) setCompact(false);
      else if (y - anchor > SCROLL_SLACK) setCompact(true);
      else if (anchor - y > SCROLL_SLACK) setCompact(false);
      else return;
      anchor = y;
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return [compact, setCompact] as const;
}

function Hero() {
  return (
    <section className="mx-auto max-w-[1120px] px-6 pt-16 sm:pt-24">
      <div className="mx-auto flex max-w-[760px] animate-enter flex-col items-center text-center">
        <Logo size={88} />
        <h1 className="mt-8 text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[64px]">{TAGLINE}</h1>
        <p className="mt-6 max-w-[580px] text-[16px] leading-relaxed text-muted text-pretty sm:text-[18px]">
          Unmerged is a browser extension that re-skins github.com in place. Same URLs, same session, same links in
          your notifications, with a calmer interface that loads faster than the one it replaces.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#install"
            className="flex h-10 items-center gap-2 rounded-lg bg-fg px-4 text-[14px] font-medium text-bg transition-opacity hover:opacity-90"
          >
            Install Unmerged
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </a>
          <a
            href={REPO_URL}
            className="flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 text-[14px] font-medium transition-colors hover:bg-hover"
          >
            <HugeiconsIcon icon={GithubIcon} className="size-4" />
            View source
          </a>
        </div>
        <p className="mt-4 text-[12.5px] text-subtle">For Chrome and Firefox</p>
      </div>
      <div className="relative mt-16 animate-enter [animation-delay:120ms] sm:mt-20">
        <ProductShot />
      </div>
    </section>
  );
}

const STATS = [
  { value: '102 ms', label: 'From a profile to one of its repos, click to content' },
  { value: '305 ms', label: 'To show a pull request on a warm reload' },
  { value: '~1 MB', label: "Of GitHub's HTML a repo page never downloads" },
];

function Stats() {
  return (
    <section className="mx-auto max-w-[1120px] px-6 pt-20">
      <div className="grid overflow-hidden rounded-2xl border border-line sm:grid-cols-3">
        {STATS.map((stat) => (
          <div key={stat.value} className="border-line bg-panel/60 px-6 py-7 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0">
            <p className="font-mono text-[32px] font-medium tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[13.5px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[12px] text-subtle">
        Measured in Chromium on public pages, medians of 3 to 5 runs. GitHub's API latency moves the numbers around.
      </p>
    </section>
  );
}

const PAGES: { icon: IconSvgElement; title: string; url: string; body: string }[] = [
  {
    icon: Home01Icon,
    title: 'Home',
    url: 'github.com',
    body: 'What needs your review, your open pull requests, assigned issues and what merged recently. No feed.',
  },
  {
    icon: GitPullRequestIcon,
    title: 'Pull requests',
    url: '/owner/repo/pull/123 · /pulls',
    body: 'Conversation, commits, checks and diffs. Batch line comments into one review, suggest changes, edit in place and merge.',
  },
  {
    icon: CircleDotIcon,
    title: 'Issues',
    url: '/owner/repo/issues/123 · /issues',
    body: 'Timeline, comments and linked pull requests. Close as completed or not planned. Lists take any ?q= search.',
  },
  {
    icon: CodeIcon,
    title: 'Repositories',
    url: '/owner/repo',
    body: 'Code, files, commits, issues and pull requests, with go-to-file on t. Admins can edit the About sidebar.',
  },
  {
    icon: Notification03Icon,
    title: 'Notifications',
    url: '/notifications',
    body: 'Inbox, unread and participating, filtered by repository. Mark as read or done from the row.',
  },
  {
    icon: UserIcon,
    title: 'Profiles',
    url: '/username',
    body: 'Repositories, achievements, followers and following, and the contribution graph.',
  },
];

function Pages() {
  return (
    <Section
      id="pages"
      eyebrow="Same URLs"
      title="It takes over the pages you live in."
      lede="Links, bookmarks and the URLs in your email all keep working, because nothing moves. Every page not listed here is GitHub as usual."
    >
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {PAGES.map((page) => (
          <div key={page.title} className="bg-bg p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-elevated text-muted">
                <HugeiconsIcon icon={page.icon} className="size-4" />
              </span>
              <h3 className="text-[15px] font-semibold tracking-tight">{page.title}</h3>
            </div>
            <p className="mt-3 font-mono text-[12px] text-accent">{page.url}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{page.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-panel/60 p-6 sm:flex-row sm:items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-muted">
          <HugeiconsIcon icon={BrowserIcon} className="size-4" />
        </span>
        <p className="text-[13.5px] leading-relaxed text-muted">
          <span className="font-medium text-fg">GitHub is one click away.</span> Classic, in the sidebar or ⌘K, shows the
          stock page for the current URL with a pill to come back. Any page can be switched off for good from the
          toolbar popup.
        </p>
      </div>
    </Section>
  );
}

const SPEED: { icon: IconSvgElement; title: string; body: string }[] = [
  {
    icon: StopCircleIcon,
    title: "GitHub's page stops loading",
    body: "Once GitHub's head arrives with who's signed in, the rest of its page is cancelled. Its HTML body and scripts never load underneath.",
  },
  {
    icon: CursorPointer01Icon,
    title: 'Requests start before the click',
    body: "Hovering, focusing or pressing a link starts that page's requests, so most navigations find their data already there.",
  },
  {
    icon: DatabaseIcon,
    title: 'The last visit paints first',
    body: 'Results are cached per account in extension storage. They show at once while the same request refreshes them.',
  },
  {
    icon: FileDiffIcon,
    title: 'Code highlighting on demand',
    body: 'Diffs and files are drawn by @pierre/diffs with Shiki. Pages without code never load it, and each grammar loads on first use.',
  },
];

function Speed() {
  return (
    <Section
      id="speed"
      eyebrow="Fast by doing less"
      title="Faster, mostly by loading less."
      lede="Data comes straight from GitHub's GraphQL API. Slow queries are split into parallel requests, and each section shows the moment its data lands."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {SPEED.map((item) => (
          <Fact key={item.title} icon={item.icon} title={item.title}>
            {item.body}
          </Fact>
        ))}
      </div>
    </Section>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'Commands, search, and jumps to owner/repo#123' },
  { keys: ['j', 'k'], label: 'Move between rows' },
  { keys: ['g', 'h'], label: 'Home' },
  { keys: ['g', 'p'], label: 'Your profile' },
  { keys: ['t'], label: 'Go to file' },
  { keys: ['⌘', '↵'], label: 'Send comment' },
  { keys: ['?'], label: 'Every shortcut on the current page' },
];

function Keyboard() {
  return (
    <Section
      id="keyboard"
      eyebrow="Keyboard first"
      title="Everything is a few keys away."
      lede="⌘K finds repos, people and your pull requests and issues by title, jumps to owner/repo#123 (or just #123 inside a repo), and carries the actions for the page you're on."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Palette />
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-panel/60">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center gap-4 px-5 py-3.5 text-[13.5px]">
              <span className="flex w-14 shrink-0 gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
              <span className="text-muted">{shortcut.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/** The ⌘K palette as it looks on a pull request, with that page's own commands. */
function Palette() {
  const items: { icon: IconSvgElement; title: string; hint?: string }[] = [
    { icon: Tick02Icon, title: 'Approve' },
    { icon: FileDiffIcon, title: 'Files changed' },
    { icon: Copy01Icon, title: 'Copy branch name', hint: 'd3oxy/review' },
    { icon: ComputerTerminal01Icon, title: 'Copy checkout command' },
    { icon: BrowserIcon, title: 'Open in classic GitHub' },
  ];
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] select-none">
      <div className="flex h-12 items-center gap-2.5 border-b border-line px-4 text-[14px] text-subtle">
        <HugeiconsIcon icon={Search01Icon} className="size-4" />
        Type a command or search…
        <span className="ml-auto">
          <Kbd>esc</Kbd>
        </span>
      </div>
      <div className="p-2">
        <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] font-medium text-subtle">Pull request</p>
        {items.map((item, i) => (
          <div
            key={item.title}
            className={`flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] ${i === 0 ? 'bg-hover text-fg' : 'text-muted'}`}
          >
            <HugeiconsIcon icon={item.icon} className="size-4" />
            {item.title}
            {item.hint && <span className="ml-auto font-mono text-[11.5px] text-subtle">{item.hint}</span>}
            {i === 0 && <span className="ml-auto"><Kbd>↵</Kbd></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Privacy() {
  return (
    <Section
      id="privacy"
      eyebrow="Privacy"
      title="Your token never leaves your browser."
      lede="Unmerged has no server and no analytics. It talks to GitHub, and to another site only when you play a video linked from it."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Fact icon={Key01Icon} title="Stored in the extension">
          Your personal access token lives in extension storage, out of reach of github.com and other extensions.
        </Fact>
        <Fact icon={GithubIcon} title="Sent only to api.github.com">
          The only requests that carry it go to GitHub's API. It is never in the page, a URL or github.com's storage.
        </Fact>
        <Fact icon={DatabaseIcon} title="Cache stays local">
          Cached results sit in extension storage per account, expire after 7 days, and are never written where
          GitHub's scripts can read them.
        </Fact>
      </div>
    </Section>
  );
}

/** An icon, a title and a sentence or two; the cards in Speed and Privacy. */
function Fact({ icon, title, children }: { icon: IconSvgElement; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/60 p-6">
      <HugeiconsIcon icon={icon} className="size-5 text-accent" />
      <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Install() {
  return (
    <Section
      id="install"
      eyebrow="Install"
      title="Two minutes, from source."
      lede="Unmerged isn't in the extension stores yet. Build it once and load it unpacked."
    >
      <ol className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Step n={1} title="Build it">
          <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg px-3.5 py-3 font-mono text-[12px] leading-relaxed text-fg/90">
            {`git clone ${REPO_URL}\ncd unmerged\npnpm install\npnpm build`}
          </pre>
          <p className="mt-3 text-[12.5px] text-subtle">
            For Firefox, run <code className="font-mono text-muted">pnpm build:firefox</code>.
          </p>
        </Step>
        <Step n={2} title="Load it">
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Open <code className="font-mono text-fg/90">chrome://extensions</code>, turn on Developer mode, click{' '}
            <span className="text-fg">Load unpacked</span> and pick{' '}
            <code className="font-mono text-fg/90">.output/chrome-mv3</code>.
          </p>
        </Step>
        <Step n={3} title="Add a token">
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Open github.com and paste a personal access token when asked. This link fills in the scopes Unmerged needs.
          </p>
          <a
            href={TOKEN_URL}
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong px-3 text-[13px] font-medium transition-colors hover:bg-hover"
          >
            Create a token
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </a>
        </Step>
      </ol>
    </Section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-line bg-panel/60 p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-accent-fg">{n}</span>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </li>
  );
}

function Section({ id, eyebrow, title, lede, children }: { id: string; eyebrow: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-[1120px] scroll-mt-8 px-6 pt-28 sm:pt-36">
      <p className="text-[13px] font-medium text-accent">{eyebrow}</p>
      <h2 className="mt-3 max-w-[640px] text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[40px]">{title}</h2>
      <p className="mt-4 max-w-[600px] text-[15.5px] leading-relaxed text-muted text-pretty">{lede}</p>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mt-32 flex max-w-[1120px] flex-col gap-4 border-t border-line px-6 py-10 text-[13px] text-subtle sm:flex-row sm:items-center">
      <span className="flex items-center gap-2 text-muted">
        <Logo size={18} />
        Unmerged
      </span>
      <span>Not affiliated with GitHub.</span>
      <span className="flex gap-5 sm:ml-auto">
        <a href={REPO_URL} className="transition-colors hover:text-fg">Source</a>
        <a href="https://deoxy.dev" className="transition-colors hover:text-fg">Made by DEOXY</a>
      </span>
    </footer>
  );
}
