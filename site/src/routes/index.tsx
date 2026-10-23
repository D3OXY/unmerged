import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  BrowserIcon,
  CircleDotIcon,
  CodeIcon,
  ComputerTerminal01Icon,
  Copy01Icon,
  Download04Icon,
  FileDiffIcon,
  GitForkIcon,
  GithubIcon,
  GitPullRequestIcon,
  Home01Icon,
  Notification03Icon,
  Search01Icon,
  Tick02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { Benchmark, benchmarkSetup } from '../components/Benchmark';
import { Screenshots } from '../components/Screenshots';
import { BUTTON, Kbd, Logo } from '../components/ui';
import sideBySidePoster from '../assets/side-by-side-poster.webp?url';
import { useInstallHref } from '../install';
import { FORK_URL, REPO_URL, TAGLINE } from '../site';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <div className="relative overflow-x-clip">
      <Nav />
      <main className="relative">
        <Hero />
        <Pages />
        <SideBySide />
        <Speed />
        <Keyboard />
      </main>
      <Footer />
    </div>
  );
}

const NAV_LINKS = [
  { href: '#pages', label: 'Pages' },
  { href: '#speed', label: 'Speed' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/install', label: 'Install' },
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
  const installHref = useInstallHref();
  return (
    <section className="mx-auto max-w-[1120px] px-6 pt-16 sm:pt-24">
      <div className="animate-enter">
        <Logo size={56} />
        <h1 className="mt-8 max-w-[860px] text-[42px] leading-[1.02] font-medium tracking-[-0.04em] text-balance sm:text-[72px]">{TAGLINE}</h1>
        <p className="mt-6 max-w-[540px] text-[16px] leading-relaxed text-muted text-pretty sm:text-[17px]">
          Unmerged is a browser extension that re-skins github.com in place. Same URLs, same session, same links in
          your notifications, with a calmer interface that loads faster than the one it replaces.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-2.5">
          <a href={installHref} className={`${BUTTON.primary} pl-4`}>
            <HugeiconsIcon icon={Download04Icon} className="size-[18px]" />
            Install
          </a>
          <a href={FORK_URL} className={`${BUTTON.secondary} pl-4`}>
            <HugeiconsIcon icon={GitForkIcon} className="size-[18px]" />
            Fork
          </a>
          <span className="ml-2 text-[13px] text-subtle">Open source</span>
        </div>
      </div>
      <div className="relative mt-16 animate-enter [animation-delay:120ms] sm:mt-20">
        <Screenshots />
      </div>
    </section>
  );
}

const PAGES: { icon: IconSvgElement; title: string; urls: string[]; body: string }[] = [
  {
    icon: Home01Icon,
    title: 'Home',
    urls: ['github.com'],
    body: 'What needs your review, your open pull requests, assigned issues and what merged recently. No feed.',
  },
  {
    icon: GitPullRequestIcon,
    title: 'Pull requests',
    urls: ['/owner/repo/pull/123', '/pulls'],
    body: 'Conversation, commits, checks and diffs. Batch line comments into one review, suggest changes, edit in place and merge.',
  },
  {
    icon: CircleDotIcon,
    title: 'Issues',
    urls: ['/owner/repo/issues/123', '/issues'],
    body: 'Timeline, comments and linked pull requests. Close as completed or not planned. Lists take any ?q= search.',
  },
  {
    icon: CodeIcon,
    title: 'Repositories',
    urls: ['/owner/repo'],
    body: 'Code, files, commits, issues and pull requests, with go-to-file on t. Admins can edit the About sidebar.',
  },
  {
    icon: Notification03Icon,
    title: 'Notifications',
    urls: ['/notifications'],
    body: 'Inbox, unread and participating, filtered by repository. Mark as read or done from the row.',
  },
  {
    icon: UserIcon,
    title: 'Profiles',
    urls: ['/username'],
    body: 'Repositories, achievements, followers and following, and the contribution graph.',
  },
];

/** One row per page: its name, the github.com URLs it answers at, and what it does there. */
function Pages() {
  return (
    <Section
      id="pages"
      title="Same URLs, new pages."
      lede="Links, bookmarks and the URLs in your email all keep working, because nothing moves. Every page not listed here is GitHub as usual."
    >
      <ul className="border-y border-line">
        {PAGES.map((page) => (
          <li
            key={page.title}
            className="grid gap-x-8 gap-y-2 border-line py-5 not-first:border-t md:grid-cols-[200px_minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-baseline md:py-6"
          >
            <h3 className="flex items-center gap-3 text-[15px] font-medium tracking-tight">
              <HugeiconsIcon icon={page.icon} className="size-[18px] shrink-0 self-center text-muted" />
              {page.title}
            </h3>
            <p className="flex flex-wrap gap-1.5">
              {page.urls.map((url) => (
                <code key={url} className="rounded-md bg-panel px-2 py-1 font-mono text-[12px] text-fg/80">
                  {url}
                </code>
              ))}
            </p>
            <p className="text-[14px] leading-relaxed text-muted">{page.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 flex gap-3 text-[14px] leading-relaxed text-muted">
        <HugeiconsIcon icon={BrowserIcon} className="mt-0.5 size-[18px] shrink-0" />
        <span>
          <span className="font-medium text-fg">GitHub is one click away.</span> Classic, in the sidebar or ⌘K, shows the
          stock page for the current URL with a pill to come back. Any page can be switched off for good from the
          toolbar popup.
        </span>
      </p>
    </Section>
  );
}

/** Served from prcl, public and with no expiry, so the repo doesn't carry the video. */
const SIDE_BY_SIDE_VIDEO = 'https://prcl.deoxy.dev/f/3qk673u0zqq4/side-by-side.mp4';

/**
 * A recording of Bun's rewrite in Rust (oven-sh/bun#30412) loading in GitHub and in Unmerged at the same time.
 * The video loads only when the reader plays it; until then, the poster shows its last frame, with both final times.
 * A large play button covers the poster, because the native controls alone make it look like a screenshot.
 */
function SideBySide() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  // The button unmounts on play, so give focus to the video once it has its controls.
  useEffect(() => {
    if (started) video.current?.focus();
  }, [started]);

  return (
    <Section
      id="side-by-side"
      title="Bun's biggest pull request, side by side."
      lede="Bun's rewrite in Rust changes 2,188 files and more than a million lines. Both sides open it, click Files changed, and scroll down through the diffs."
    >
      <figure>
        <div className="relative">
          <video
            ref={video}
            src={SIDE_BY_SIDE_VIDEO}
            poster={sideBySidePoster}
            controls={started}
            playsInline
            preload="none"
            width={1920}
            height={1080}
            onPlay={() => setStarted(true)}
            aria-label="GitHub and Unmerged open the same pull request side by side, with a timer and live metrics under each"
            className="h-auto w-full rounded-lg bg-panel"
          />
          {!started && (
            <button
              type="button"
              aria-label="Play the side-by-side video (35 seconds)"
              onClick={() => void video.current?.play()}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/25 transition-colors duration-150 hover:bg-black/10"
            >
              <span className="grid size-16 place-items-center rounded-full bg-fg text-bg shadow-[0_10px_40px_-8px_rgb(0_0_0/0.6)] transition-transform duration-150 group-hover:scale-105 group-active:scale-95 sm:size-24">
                <svg aria-hidden viewBox="0 0 24 24" className="ml-1 size-7 sm:size-10" fill="currentColor">
                  <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
                </svg>
              </span>
              <span className="glass hidden rounded-full px-3 py-1 font-mono text-[12px] text-fg sm:block">0:35</span>
            </button>
          )}
        </div>
        <figcaption className="mt-4 max-w-[760px] text-[12.5px] leading-relaxed text-subtle">
          First diff on screen: GitHub in 22.5 s, Unmerged in 4.3 s. Both signed out of github.com, each in a new
          Chromium profile on the same machine and connection. Each side is the median of three recordings.
        </figcaption>
      </figure>
    </Section>
  );
}

/** What Unmerged does to make a page fast, in the order it happens: from the hover before the click to the scroll after. */
const STEPS: { stage: string; title: string; body: ReactNode }[] = [
  {
    stage: 'Hover',
    title: 'Requests start before the click',
    body: "Hovering, focusing or pressing a link starts that page's requests, so most navigations find their data already there.",
  },
  {
    stage: 'Open',
    title: "GitHub's full page never loads",
    body: "On a new tab, a reload or a link from another site, GitHub sends a small page in about 200\u00a0ms instead of building the full one, which can take seconds on a large pull request. The page's data starts loading at once. In Firefox, GitHub's page stops loading as soon as its head arrives.",
  },
  {
    stage: 'First paint',
    title: 'The last visit paints first',
    body: 'Results are cached per account in extension storage. They show at once while the same request refreshes them.',
  },
  {
    stage: 'Fill in',
    title: 'Each part shows when it is ready',
    body: 'A pull request shows its description first, then the checks, reviews and merge box as each one loads. An issue shows its newest comments first. Lists show their rows in about a second, and the details follow.',
  },
  {
    stage: 'Diffs',
    title: 'Code drawn by @pierre/diffs',
    body: (
      <>
        <a href="https://diffs.com">@pierre/diffs</a> uses CSS Grid and Shadow DOM, "meaning fewer DOM nodes and faster rendering",
        with <a href="https://shiki.style">Shiki</a>, the same highlighting engine as VS Code. The text shows at once and the colors
        follow from a background worker, so highlighting never blocks scrolling. Diffs draw only near the screen.
      </>
    ),
  },
  {
    stage: 'Scroll',
    title: 'Images load when you get near them',
    body: 'Images in comments, READMEs and release notes load as you scroll to them, and keep their space while they load.',
  },
  {
    stage: 'Everywhere else',
    title: "GitHub's own pages stay as fast",
    body: "Unmerged's code doesn't run on the pages it leaves to GitHub, so they open as fast as without the extension.",
  },
];

function Speed() {
  const setup = benchmarkSetup;
  return (
    <Section
      id="speed"
      title="Measured against GitHub."
      lede={`${setup.pages} public pages of TanStack/query and of Bun's rewrite in Rust, each loaded ${setup.runs} times in Chromium: as GitHub serves them, and with Unmerged. Both ${setup.signedIn ? 'signed in' : 'signed out'}. These are the medians.`}
    >
      <Benchmark />
      <p className="mt-4 max-w-[760px] text-[12.5px] leading-relaxed text-subtle">
        Time is until the page's content is on screen: for a page load from the start of the navigation, for a click from
        the click, after a 150 ms hover on the link. Data is what crossed the network, compressed. Median of {setup.runs} runs on {setup.date}, {setup.signedIn ? 'signed in to' : 'signed out of'} github.com,
        in headless Chromium.{' '}
        <a href={`${REPO_URL}/tree/main/bench`} className="text-muted underline underline-offset-2 hover:text-fg">
          How it's measured, and run it yourself
        </a>
        .
      </p>
      <Timeline />
      <p className="mt-16 max-w-[760px] text-[12.5px] leading-relaxed text-subtle">
        GitHub's own engineers found that on large pull requests "the JavaScript heap could exceed 1 GB, DOM node counts
        surpassed 400,000" (
        <a
          href="https://github.blog/engineering/architecture-optimization/the-uphill-climb-of-making-diff-lines-performant/"
          className="text-muted underline underline-offset-2 hover:text-fg"
        >
          The uphill climb of making diff lines performant
        </a>
        , April 2026).
      </p>
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
      title="Everything is a few keys away."
      lede="⌘K finds repos, people and your pull requests and issues by title, jumps to owner/repo#123 (or just #123 inside a repo), and carries the actions for the page you're on."
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:gap-14">
        {/* The palette floats on a warm, painted-looking panel: layered gradients, no image to download. */}
        <div className="rounded-lg bg-[radial-gradient(90%_70%_at_0%_0%,#6b4b2e_0%,transparent_65%),radial-gradient(80%_80%_at_100%_100%,#3b2f55_0%,transparent_60%),linear-gradient(160deg,#2b231b,#1c1915)] px-5 py-10 sm:px-12 sm:py-16">
          <Palette />
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between gap-6 py-3.5 text-[14px]">
              <span className="text-muted">{shortcut.label}</span>
              <span className="flex shrink-0 gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key} className="h-6 min-w-6 px-1.5 text-[12px]">
                    {key}
                  </Kbd>
                ))}
              </span>
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
    <div aria-hidden className="mx-auto max-w-[560px] overflow-hidden rounded-lg border border-line-strong bg-panel shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] select-none">
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
            className={`flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] ${i === 0 ? 'bg-hover text-fg' : 'text-muted'}`}
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

/** The STEPS on a vertical line, one dot per step, each step's moment in a column beside it from md up. */
function Timeline() {
  return (
    <ol className="mt-20 [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-2">
      {STEPS.map((step) => (
        <li
          key={step.stage}
          // The line runs from below this step's dot to just above the next one.
          className="relative grid gap-x-10 gap-y-1.5 pb-12 pl-8 last:pb-0 not-last:before:absolute not-last:before:top-[19px] not-last:before:-bottom-[3px] not-last:before:left-[3.5px] not-last:before:w-px not-last:before:bg-line-strong md:grid-cols-[160px_minmax(0,1fr)]"
        >
          <span aria-hidden className="absolute top-[7px] left-0 size-2 rounded-full bg-muted" />
          <p className="font-mono text-[12.5px] leading-5 text-subtle md:pt-0.5">{step.stage}</p>
          <div className="max-w-[640px]">
            <h3 className="text-[16px] leading-6 font-medium tracking-tight">{step.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A section of the home page: the title with its lede running on after it in a muted color, then the content. */
function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-[1120px] scroll-mt-20 px-6 pt-32 sm:pt-44">
      <div className="max-w-[880px] text-[24px] leading-[1.25] font-medium tracking-[-0.025em] text-pretty sm:text-[30px]">
        <h2 className="inline">{title}</h2> <p className="inline text-muted">{lede}</p>
      </div>
      <div className="mt-12 sm:mt-14">{children}</div>
    </section>
  );
}

const FOOTER_LINKS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '#pages', label: 'Pages' },
      { href: '#speed', label: 'Speed' },
      { href: '#keyboard', label: 'Keyboard' },
      { href: '/install', label: 'Install' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { href: REPO_URL, label: 'Source code' },
      { href: FORK_URL, label: 'Fork' },
      { href: '/install/source', label: 'Build from source' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/support', label: 'Support' },
      { href: `${REPO_URL}/issues/new`, label: 'Report a problem' },
      { href: '/privacy', label: 'Privacy policy' },
    ],
  },
];

/** Holdout, the tagline and Install on the left, link columns on the right, then the credits and a large wordmark. */
function Footer() {
  const installHref = useInstallHref();
  return (
    <footer className="mx-auto mt-40 max-w-[1120px] overflow-hidden px-6">
      <div className="grid gap-12 border-t border-line pt-14 md:grid-cols-[minmax(0,1fr)_auto] md:gap-20">
        <div>
          <Logo size={40} />
          <p className="mt-5 max-w-[320px] text-[20px] leading-snug font-medium tracking-[-0.02em] text-balance">{TAGLINE}</p>
          <a href={installHref} className={`${BUTTON.primary} mt-7 w-fit pl-4`}>
            <HugeiconsIcon icon={Download04Icon} className="size-[18px]" />
            Install
          </a>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
          {FOOTER_LINKS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-[13px] text-subtle">{column.title}</h2>
              <ul className="mt-4 space-y-3 text-[14px] text-muted">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="transition-colors hover:text-fg">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="mt-20 flex flex-col gap-3 text-[12.5px] text-subtle sm:flex-row sm:items-center sm:justify-between">
        <span>Not affiliated with GitHub.</span>
        <a
          href="https://deoxy.dev"
          aria-label="Designed and engineered by DEOXY"
          className="font-mono whitespace-nowrap transition-opacity hover:opacity-80"
        >
          <span className="text-violet-400">&lt;Designed/&gt;</span> &amp; <span className="text-emerald-400">Engineered()</span> by{' '}
          <span className="font-semibold text-blue-500">DEOXY</span>
        </a>
      </div>
      <p
        aria-hidden
        className="mt-6 -mb-[0.22em] text-center text-[clamp(72px,19vw,232px)] leading-none font-medium tracking-[-0.06em] text-panel select-none"
      >
        Unmerged
      </p>
    </footer>
  );
}
