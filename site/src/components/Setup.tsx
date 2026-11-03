import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon, GitPullRequestIcon, Key01Icon, LockIcon, PuzzleIcon } from '@hugeicons/core-free-icons';
import { ChromeLogo } from './brands';
import { Kbd, Logo } from './ui';
import { CHROME_STORE_URL, FIREFOX_STORE_URL, TOKEN_DOCS_URL, TOKEN_URL } from '../site';

/**
 * The three setup steps in one panel, each with a small drawing of what the reader sees at that step, then the
 * choice of token under it. Below md the steps stack, and the store links, the last step's drawing and the token
 * comparison are left out; the home page's FAQ answers which token to use there.
 */
export function Setup() {
  return (
    <div className="space-y-2">
      <ol className="grid overflow-hidden rounded-xl border border-line bg-panel md:grid-cols-3">
        <Step n={1} title="Add Unmerged" stage={<StoreStage />} body="From your browser's extension store. There is no account to make.">
          <span className="hidden gap-4 md:flex">
            <ArrowLink href={CHROME_STORE_URL}>Chrome</ArrowLink>
            <ArrowLink href={FIREFOX_STORE_URL}>Firefox</ArrowLink>
          </span>
        </Step>
        <Step n={2} title="Paste a token" stage={<PopupStage />} body="Click the Unmerged icon in the toolbar. The token goes only to api.github.com.">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="hidden md:block">
              <ArrowLink href={TOKEN_URL}>Create a token with the right scopes</ArrowLink>
            </span>
            <span className="md:hidden">
              <ArrowLink href="/#which-token">Which token to use</ArrowLink>
            </span>
            <ArrowLink href="/token">Why a token?</ArrowLink>
          </span>
        </Step>
        <Step n={3} title="Open any GitHub link" stage={<GitHubStage />} wide body="Pull requests, issues and notifications open in Unmerged, at the same URLs.">
          <span className="hidden items-center gap-1.5 text-[13px] text-muted md:flex">
            <Kbd className="h-5 px-1.5 text-[11.5px] text-fg">⌘K</Kbd> to search, <Kbd className="h-5 px-1.5 text-[11.5px] text-fg">?</Kbd> for shortcuts
          </span>
        </Step>
      </ol>
      <WhichToken />
    </div>
  );
}

/** One step: its drawing, then its number, title and text, and links at the bottom. A `wide` drawing shows only from md up. */
function Step({
  n,
  title,
  body,
  stage,
  wide = false,
  children,
}: {
  n: number;
  title: string;
  body: string;
  stage: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col border-line not-first:border-t md:not-first:border-t-0 md:not-first:border-l">
      <div
        aria-hidden
        className={`${wide ? 'hidden md:flex' : 'flex'} h-[220px] items-center justify-center border-b border-line bg-[radial-gradient(120%_90%_at_50%_0%,var(--u-elevated)_0%,var(--u-panel)_70%)] select-none md:h-[260px]`}
      >
        {stage}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5 md:px-7 md:pt-6 md:pb-7">
        <h3 className="flex items-center gap-2.5 text-[16px] font-medium tracking-tight">
          <span className="flex size-[22px] items-center justify-center rounded-full border border-line-strong font-mono text-[11px] text-muted">{n}</span>
          {title}
        </h3>
        <p className="text-[14px] leading-relaxed text-muted">{body}</p>
        <div className="mt-auto pt-1.5 empty:hidden">{children}</div>
      </div>
    </li>
  );
}

function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-[13px] font-medium transition-colors hover:text-white"
    >
      {children}
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5 text-muted" />
    </a>
  );
}

/** A small browser window with an address bar, for the drawings. */
function Window({ url, className = '', children }: { url: string; className?: string; children: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-[10px] border border-line-strong bg-bg shadow-[0_20px_40px_-16px_rgb(0_0_0/0.7)] ${className}`}>
      <div className="flex h-[30px] items-center gap-1.5 border-b border-line px-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-[7px] rounded-full bg-elevated" />
        ))}
        <span className="ml-1 flex h-[18px] min-w-0 flex-1 items-center gap-1.5 rounded-full bg-panel px-2 text-[10px] text-subtle">
          <HugeiconsIcon icon={LockIcon} className="size-2.5 shrink-0" />
          <span className="truncate">{url}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function StoreStage() {
  return (
    <Window url="chromewebstore.google.com" className="w-[269px]">
      <div className="space-y-3.5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-[10px] bg-elevated">
            <Logo size={34} />
          </span>
          <span>
            <span className="block text-[14px] font-semibold">Unmerged</span>
            <span className="block text-[11px] text-subtle">Extension · Developer tools</span>
          </span>
        </div>
        <span className="flex items-center gap-2">
          <span className="flex h-8 items-center gap-1.5 rounded-full bg-fg pr-3.5 pl-[11px] text-[12.5px] font-medium text-bg">
            <ChromeLogo className="size-3.5" />
            Add to Chrome
          </span>
          <svg viewBox="0 0 24 24" className="size-[18px]">
            <path d="M5 3l14 8-6.2 1.6L10 19z" className="fill-fg stroke-bg" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Window>
  );
}

/** The toolbar popup's token form, as the extension draws it (see TokenForm in src/app/SettingsPanel.tsx). */
function PopupStage() {
  return (
    <div className="flex flex-col items-end self-start pt-5">
      <span className="flex gap-1 rounded-lg border border-line bg-bg p-[3px]">
        <span className="flex size-6 items-center justify-center text-subtle">
          <HugeiconsIcon icon={PuzzleIcon} className="size-3.5" />
        </span>
        <span className="flex size-6 items-center justify-center rounded-md bg-elevated">
          <Logo size={16} />
        </span>
      </span>
      <div className="mt-2 w-[286px] overflow-hidden rounded-[10px] border border-line-strong bg-bg shadow-[0_20px_40px_-16px_rgb(0_0_0/0.7)]">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2.5">
          <Logo size={22} />
          <span>
            <span className="block text-[12px] font-semibold">Unmerged</span>
            <span className="block text-[9.5px] text-subtle">GitHub, as if it never got acquired.</span>
          </span>
        </div>
        <div className="space-y-2 px-3 pt-0.5 pb-3.5">
          <p className="text-[10.5px] leading-snug text-muted">Paste a GitHub token. It's kept in the extension's storage and sent only to api.github.com.</p>
          <span className="flex gap-1.5">
            <span className="flex h-7 flex-1 items-center gap-1.5 rounded-[7px] border border-accent/55 bg-panel px-2">
              <HugeiconsIcon icon={Key01Icon} className="size-[11px] text-subtle" />
              <span className="font-mono text-[10.5px]">ghp_••••••••••••</span>
            </span>
            <span className="flex h-7 items-center rounded-[7px] bg-accent px-[11px] text-[11px] font-medium text-accent-fg">Save</span>
          </span>
          <span className="flex items-center gap-0.5 text-[10.5px] text-[#8b8aff]">
            Create a token <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** A pull request open in Unmerged at its usual github.com address. */
function GitHubStage() {
  return (
    <Window url="github.com/D3OXY/unmerged/pull/143" className="w-[285px]">
      <div className="flex h-[150px]">
        <div className="flex w-[62px] flex-col gap-[7px] border-r border-line px-2 py-2.5">
          <Logo size={14} />
          {[40, 34, 44, 30, 38].map((w, i) => (
            <span key={i} className={`h-[5px] rounded-full ${i === 2 ? 'bg-line-strong' : 'bg-elevated'}`} style={{ width: w }} />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <span className="text-[11px] leading-snug font-semibold">Say when GitHub lists only the first 3,000 changed files</span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 items-center gap-[3px] rounded-full bg-success/15 px-1.5 text-[9px] font-medium text-success">
              <HugeiconsIcon icon={GitPullRequestIcon} className="size-[9px]" />
              Open
            </span>
            <span className="text-[9px] text-subtle">#143 · 3 commits</span>
          </span>
          <span className="flex gap-2.5 border-b border-line pt-0.5 text-[9px] text-subtle">
            <span className="border-b border-fg pb-[5px] text-fg">Conversation</span>
            <span>Commits</span>
            <span>Checks</span>
            <span>Files</span>
          </span>
          {[180, 150, 120].map((w) => (
            <span key={w} className="h-[5px] rounded-full bg-elevated" style={{ width: w }} />
          ))}
        </div>
      </div>
    </Window>
  );
}

/** Classic or fine-grained, with what each allows. The README's token section has the full list of permissions. */
function WhichToken() {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-line bg-panel md:grid md:grid-cols-[292px_1fr_1fr]">
      <div className="px-7 py-6">
        <h3 className="flex items-center gap-2 text-[15px] font-medium">
          <HugeiconsIcon icon={Key01Icon} className="size-4 text-subtle" />
          Which token?
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
          Both work. You can change it later in the popup. A new token removes everything cached for the old one.
        </p>
      </div>
      <TokenKind name="Classic token" tag="Simplest" href={TOKEN_URL} link="Create a classic token">
        Every page works. The link fills in the scopes for you. It can write to your private repos, because classic
        tokens have no read-only scope for them.
      </TokenKind>
      <TokenKind name="Fine-grained token" tag="Least access" href={TOKEN_DOCS_URL} link="Which permissions to give">
        Give it only the permissions you use, for one owner. Notifications needs a classic token, so switch that page
        off in the popup.
      </TokenKind>
    </div>
  );
}

function TokenKind({ name, tag, href, link, children }: { name: string; tag: string; href: string; link: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-l border-line px-7 py-6">
      <h4 className="flex items-center gap-2 text-[14px] font-medium">
        {name}
        <span className="rounded-full bg-elevated px-[7px] py-px text-[11px] font-normal text-muted">{tag}</span>
      </h4>
      <p className="text-[13px] leading-relaxed text-muted">{children}</p>
      <div className="mt-auto pt-1">
        <ArrowLink href={href}>{link}</ArrowLink>
      </div>
    </div>
  );
}
