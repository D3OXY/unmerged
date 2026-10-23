import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  BrowserIcon,
  CircleDotIcon,
  CodeIcon,
  ComputerTerminal01Icon,
  Copy01Icon,
  FileDiffIcon,
  GitPullRequestIcon,
  Home01Icon,
  Notification03Icon,
  Search01Icon,
  Tick02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { Benchmark, benchmarkSetup } from '../components/Benchmark';
import { Footer } from '../components/Footer';
import { InstallButtons } from '../components/InstallButtons';
import { Nav } from '../components/Nav';
import { Screenshots } from '../components/Screenshots';
import { Setup } from '../components/Setup';
import { AlphaPill, Kbd, Logo } from '../components/ui';
import sideBySidePoster from '../assets/side-by-side-poster.webp?url';
import { NEW_ISSUE_URL, REPO_URL, TAGLINE } from '../site';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <div className="relative overflow-x-clip">
      <Nav />
      <main className="relative">
        <Hero />
        <Section id="setup" title="Set up in three steps." lede="Add the extension, paste a token, then use GitHub as you do now.">
          <Setup />
        </Section>
        <Pages />
        <SideBySide />
        <Speed />
        <Keyboard />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-[1120px] px-6 pt-16 sm:pt-24">
      <div className="animate-enter">
        <Logo size={56} />
        <h1 className="mt-8 max-w-[860px] text-[42px] leading-[1.02] font-medium tracking-[-0.04em] text-balance sm:text-[72px]">{TAGLINE}</h1>
        <p className="mt-6 mb-9 max-w-[560px] text-[16px] leading-relaxed text-muted text-pretty sm:text-[17px]">
          Unmerged is a browser extension that re-skins github.com in place. Same URLs, same session, same links in
          your notifications. It is free and open source, and you do not need an account.
        </p>
        <InstallButtons hero />
        <p className="mt-2.5 text-[13px] leading-6 text-subtle">
          <AlphaPill />
          Unmerged changes often, and some things can break.{' '}
          <a href={NEW_ISSUE_URL} className="text-muted underline underline-offset-2 transition-colors hover:text-fg">
            Report a problem
          </a>
        </p>
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
    </Section>
  );
}

/** `wide` shortcuts show only from md up; narrow screens get the few that explain the idea. */
const SHORTCUTS: { keys: string[]; label: string; wide?: boolean }[] = [
  { keys: ['⌘', 'K'], label: 'Commands, search, and jumps to owner/repo#123' },
  { keys: ['j', 'k'], label: 'Move between rows' },
  { keys: ['g', 'h'], label: 'Home', wide: true },
  { keys: ['g', 'p'], label: 'Your profile', wide: true },
  { keys: ['t'], label: 'Go to file' },
  { keys: ['⌘', '↵'], label: 'Send comment', wide: true },
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
        {/* The palette floats on a warm, painted-looking panel: layered gradients, no image to download. Shown from md up. */}
        <div className="hidden rounded-lg md:block bg-[radial-gradient(90%_70%_at_0%_0%,#6b4b2e_0%,transparent_65%),radial-gradient(80%_80%_at_100%_100%,#3b2f55_0%,transparent_60%),linear-gradient(160deg,#2b231b,#1c1915)] px-5 py-10 sm:px-12 sm:py-16">
          <Palette />
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.label}
              className={`items-center justify-between gap-6 py-3.5 text-[14px] ${shortcut.wide ? 'hidden md:flex' : 'flex'}`}
            >
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

/** How many STEPS show until the reader asks for all of them. */
const STEPS_SHOWN = 3;

/**
 * The STEPS on a vertical line, one dot per step, each step's moment in a column beside it from md up. The first
 * few show; a button shows the rest.
 */
function Timeline() {
  const [all, setAll] = useState(false);
  return (
    <div className="mt-20">
      <h3 className="mb-6 text-[13px] font-medium text-subtle">How it works</h3>
      <ol id="speed-steps" className="[&_a]:text-fg [&_a]:underline [&_a]:underline-offset-2">
        {STEPS.slice(0, all ? STEPS.length : STEPS_SHOWN).map((step) => (
          <li
            key={step.stage}
            // The line runs from below this step's dot to just above the next one.
            className="relative grid gap-x-10 gap-y-1.5 pb-12 pl-8 last:pb-0 not-last:before:absolute not-last:before:top-[19px] not-last:before:-bottom-[3px] not-last:before:left-[3.5px] not-last:before:w-px not-last:before:bg-line-strong md:grid-cols-[160px_minmax(0,1fr)]"
          >
            <span aria-hidden className="absolute top-[7px] left-0 size-2 rounded-full bg-muted" />
            <p className="font-mono text-[12.5px] leading-5 text-subtle md:pt-0.5">{step.stage}</p>
            <div className="max-w-[640px]">
              <h4 className="text-[16px] leading-6 font-medium tracking-tight">{step.title}</h4>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        aria-expanded={all}
        aria-controls="speed-steps"
        onClick={() => setAll(!all)}
        className="mt-8 ml-8 h-8 cursor-pointer rounded-full border border-line-strong px-3.5 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg"
      >
        {all ? 'Show fewer steps' : `Show all ${STEPS.length} steps`}
      </button>
    </div>
  );
}

/**
 * What people ask before they install. `narrow` answers show only below md, where the setup section leaves out the
 * token comparison; `which-token` is the target of setup step 2's link there.
 */
const QUESTIONS: { id?: string; q: string; a: string; narrow?: boolean }[] = [
  {
    q: 'What data does Unmerged collect?',
    a: 'None. It has no server, no analytics and no accounts. Your token and your GitHub data go only to GitHub.',
  },
  {
    q: 'Why does it need a token?',
    a: "Unmerged reads your pull requests, issues and notifications from GitHub's API, and the API needs a token.",
  },
  {
    id: 'which-token',
    q: 'Which token should I use?',
    a: 'A classic token is the simplest, and every page works with it. A fine-grained token gives less access, for one owner, but Notifications needs a classic token.',
    narrow: true,
  },
  {
    q: 'Does it change my GitHub account?',
    a: 'Only when you act, for example when you comment, review, merge or mark a notification as done. Unmerged changes no settings.',
  },
  {
    q: "How do I get GitHub's page back?",
    a: 'Use Classic in the sidebar or ⌘K for one tab, switch off a page in the toolbar popup, or remove the extension. Nothing else needs undoing.',
  },
  {
    q: 'Which browsers work?',
    a: 'Chrome, Arc, Brave, Edge and other Chromium browsers, and Firefox 140 or later. Desktop only: phones and tablets cannot run it.',
  },
  {
    q: 'Does it cost anything?',
    a: 'No. Unmerged is free and MIT-licensed. You can read the code, build it yourself or fork it.',
  },
];

function Faq() {
  return (
    <Section id="faq" title="Before you install." lede="Short answers to what people ask first.">
      <dl className="grid border-t border-line md:grid-cols-2 md:gap-x-14">
        {QUESTIONS.map(({ id, q, a, narrow }) => (
          <div key={q} id={id} className={`scroll-mt-24 border-b border-line py-5 md:py-6 ${narrow ? 'md:hidden' : ''}`}>
            <dt className="text-[15px] font-medium md:text-[16px]">{q}</dt>
            <dd className="mt-1.5 text-[14px] leading-relaxed text-muted">{a}</dd>
          </div>
        ))}
      </dl>
    </Section>
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
