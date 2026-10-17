import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  CircleDotIcon,
  FileCodeIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  ArrowDown01Icon,
  Settings02Icon,
  SmilePlusIcon,
  Tick02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { Kbd } from '../ui';
import { Avatar, Button, cx, Markdown, Panel, Pill } from './bits';
import { FILES, THREAD } from './pr';

/** The Conversation tab (src/pages/pr/ConversationTab.tsx): description, review threads, timeline and composer, merge controls on the right. */
export function Conversation() {
  return (
    <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <CommentCard author="d3oxy" when="5h ago" reactions={[['🚀', 3]]}>
          <p>
            Line comments now collect into one pending review, like on GitHub. Drafts survive a reload, and approving
            offers the next pull request waiting on you.
          </p>
        </CommentCard>
        <section>
          <div className="flex h-8 items-center gap-2 px-1">
            <h2 className="text-[12px] font-medium text-muted">Review threads</h2>
            <span className="text-[12px] text-subtle tabular-nums">1</span>
          </div>
          <ReviewThread />
        </section>
        <Timeline />
        <Composer />
      </div>
      <aside className="flex flex-col gap-4 *:shrink-0">
        <MergeBox />
        <Card title="Checks" count={3}>
          <span className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-muted">
            <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-success" />3 successful or skipped
          </span>
        </Card>
        <PeopleCard />
        <Card title="Files" count={FILES.length}>
          {FILES.slice(0, 10).map((file) => (
            <FileRow key={file.path} path={file.path} additions={file.additions} deletions={file.deletions} added={file.status === 'added'} />
          ))}
        </Card>
      </aside>
    </div>
  );
}

function CommentCard({ author, when, reactions = [], children }: { author: string; when: string; reactions?: [string, number][]; children: ReactNode }) {
  return (
    <div className="relative py-2.5">
      <div className="flex gap-3">
        <Avatar name={author} size={32} className="relative z-10 ring-4 ring-bg" />
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex h-9 items-center gap-2 border-b border-line px-4 text-[12.5px]">
            <span className="font-semibold">{author}</span>
            <span className="text-subtle">{when}</span>
          </div>
          <div className="px-4 py-3">
            <Markdown>{children}</Markdown>
            <Reactions reactions={reactions} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Reactions({ reactions }: { reactions: [string, number][] }) {
  return (
    <div className="mt-2 flex items-center gap-1">
      {reactions.map(([emoji, count]) => (
        <span key={emoji} className="flex h-6 items-center gap-1 rounded-full border border-line px-2 text-[12px] text-muted tabular-nums">
          {emoji} {count}
        </span>
      ))}
      <Button size="icon" variant="ghost" icon={<HugeiconsIcon icon={SmilePlusIcon} className="size-3.5" />} className="size-6" />
    </div>
  );
}

/** A review thread pulled up into the conversation, with its hunk (src/pages/pr/Threads.tsx). */
function ReviewThread() {
  const hunk = [
    ' * The next pull request waiting on you, offered after you approve or merge one. Skips the one you just',
    ' * reviewed.',
    ' */',
    ' export function nextReview(prs: Pr[]) {',
    '-  return prs.find((pr) => pr.reviewRequested);',
    '+  return prs.find((pr) => pr.reviewRequested && !pr.isDraft);',
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <span className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 shrink-0 rotate-90 text-subtle" />
          <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 shrink-0 text-subtle" />
          <span className="truncate font-mono text-[12px]">
            {THREAD.path}<span className="text-subtle">:{THREAD.line}</span>
          </span>
        </span>
        <span className="ml-auto text-[12px] text-subtle">2 comments</span>
        <Button size="sm">Resolve</Button>
      </div>
      <pre className="overflow-hidden border-b border-line bg-bg py-2 font-mono text-[11.5px] leading-[1.6]">
        {hunk.map((line, i) => (
          <div key={i} className={cx('px-4 whitespace-pre', line.startsWith('+') && 'bg-success/10 text-success', line.startsWith('-') && 'bg-danger/10 text-danger')}>
            {line}
          </div>
        ))}
      </pre>
      <ThreadComments />
      <ThreadReply />
    </div>
  );
}

/** The thread's comments; the viewer's reply is still in their pending review. */
export function ThreadComments() {
  return (
    <div className="flex flex-col divide-y divide-line">
      <ThreadComment author="holdout" when="3h ago">
        <p>Drafts shouldn't count as waiting on you.</p>
      </ThreadComment>
      <ThreadComment author="d3oxy" when="2h ago" pending>
        <p>
          Good catch. They're skipped now, and <code>nextReview.test.ts</code> covers it.
        </p>
      </ThreadComment>
    </div>
  );
}

function ThreadComment({ author, when, pending, children }: { author: string; when: string; pending?: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Avatar name={author} size={22} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[12.5px]">
          <span className="font-semibold">{author}</span> <span className="text-subtle">{when}</span>
          {pending && <Pill className="ml-1.5 h-[18px] border-warning/40 text-warning">Pending</Pill>}
        </div>
        <Markdown>{children}</Markdown>
        <Reactions reactions={[]} />
      </div>
    </div>
  );
}

export function ThreadReply() {
  return (
    <div className="border-t border-line p-2.5">
      <CommentBox rows={2} placeholder="Reply…" className="bg-bg">
        <Button size="sm" variant="primary" disabled className="ml-auto">
          Reply
        </Button>
      </CommentBox>
    </div>
  );
}

function CommentBox({ rows, placeholder, className, children }: { rows: number; placeholder: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-xl border border-line bg-panel', className)}>
      <textarea
        readOnly
        tabIndex={-1}
        rows={rows}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent px-3.5 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-subtle"
      />
      <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">{children}</div>
    </div>
  );
}

/** Activity: quiet one-liners on a rail (src/pages/pr/Timeline.tsx). */
function Timeline() {
  return (
    <div className="relative">
      <div className="absolute top-2 bottom-2 left-[15px] w-px bg-line" />
      <Commit message="Collect line comments into one pending review" sha="4f2a9c1" author="d3oxy" />
      <Commit message="Keep comment drafts across reloads" sha="b81d3e7" author="d3oxy" />
      <EventLine icon={<HugeiconsIcon icon={ViewIcon} />} actor="d3oxy" at="4h ago">
        requested review from <span className="font-medium text-fg/90">holdout</span>
      </EventLine>
      <EventLine icon={<HugeiconsIcon icon={CircleDotIcon} />} tone="danger" actor="holdout" at="3h ago">
        requested changes
      </EventLine>
      <Commit message="Skip drafts when offering the next review" sha="e93c0d2" author="d3oxy" />
      <EventLine icon={<HugeiconsIcon icon={Tick02Icon} />} tone="success" actor="holdout" at="20m ago">
        approved these changes
      </EventLine>
    </div>
  );
}

function Commit({ message, sha, author }: { message: string; sha: string; author: string }) {
  return (
    <EventLine icon={<HugeiconsIcon icon={GitCommitHorizontalIcon} />}>
      <span className="flex min-w-0 items-center gap-2">
        <Avatar name={author} size={16} />
        <span className="truncate text-fg/90">{message}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <HugeiconsIcon icon={Tick02Icon} className="size-3.5 shrink-0 text-success" strokeWidth={2.5} />
        <code className="font-mono text-[11.5px] text-subtle">{sha}</code>
      </span>
    </EventLine>
  );
}

function EventLine({ icon, tone, actor, at, children }: { icon: ReactNode; tone?: 'success' | 'danger'; actor?: string; at?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-9 items-center gap-3 py-1 text-[12.5px] text-muted">
      <span
        className={cx(
          'relative z-10 flex size-[31px] shrink-0 items-center justify-center rounded-full border border-line bg-bg [&>svg]:size-3.5',
          tone === 'success' && 'border-success/30 bg-success/10 text-success',
          tone === 'danger' && 'border-danger/30 bg-danger/10 text-danger',
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {actor && (
          <span className="flex shrink-0 items-center gap-1.5 font-medium text-fg">
            <Avatar name={actor} size={16} />
            {actor}
          </span>
        )}
        {children}
        {at && <span className="ml-1 shrink-0 text-subtle">· {at}</span>}
      </div>
    </div>
  );
}

/** The author's composer while their pending review holds a comment. */
function Composer() {
  return (
    <CommentBox rows={4} placeholder="Summarize your review… (optional)">
      <Button size="sm" variant="ghost">
        Close pull request
      </Button>
      <Pill className="border-warning/40 text-warning">1 pending comment</Pill>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="primary">
          Submit review
          <span className="flex gap-0.5 opacity-70">
            <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">⌘</Kbd>
            <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">↵</Kbd>
          </span>
        </Button>
      </div>
    </CommentBox>
  );
}

/** Requirements as a checklist, one obvious primary action (src/pages/pr/MergeBox.tsx). */
function MergeBox() {
  const requirements = [{ label: 'Approved' }, { label: 'All checks passed', detail: '3' }, { label: 'No conflicts' }];
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-0.5 p-2">
        {requirements.map((r) => (
          <div key={r.label} className="flex h-8 items-center gap-2.5 rounded-md px-2">
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white">
              <HugeiconsIcon icon={Tick02Icon} className="size-2.5" strokeWidth={3.5} />
            </span>
            <span className="text-[12.5px] text-fg/90">{r.label}</span>
            {r.detail && <span className="text-[12px] text-subtle">{r.detail}</span>}
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <div className="flex">
          <Button variant="success" className="flex-1 justify-center rounded-r-none">
            Squash and merge
          </Button>
          <span className="flex h-8 items-center rounded-r-lg border-l border-black/20 bg-success px-2 text-white">
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11.5px] text-subtle">
        <HugeiconsIcon icon={GitBranchIcon} className="size-3" />
        <span className="truncate font-mono">d3oxy/review</span>
        <span>→</span>
        <span className="truncate font-mono">main</span>
      </div>
    </Panel>
  );
}

function PeopleCard() {
  return (
    <Card title="People">
      <Field label="Reviewers">
        <Person name="holdout" trailing={<HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-success" strokeWidth={2.5} />} />
      </Field>
      <Field label="Assignees">
        <Person name="d3oxy" />
      </Field>
      <Field label="Labels">
        <div className="flex flex-wrap gap-1.5 px-2 pt-0.5">
          <Pill color="7170ff">review</Pill>
          <Pill color="4cb782">perf</Pill>
        </div>
      </Field>
    </Card>
  );
}

function Card({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <Panel className="p-2">
      <div className="flex h-7 items-center gap-1.5 px-2 text-[12px] font-medium text-muted">
        {title}
        {count !== undefined && <span className="font-normal text-subtle tabular-nums">{count}</span>}
      </div>
      {children}
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-2 pb-0.5 text-[11px] text-subtle">
        {label}
        <span className="flex size-5 items-center justify-center rounded text-subtle">
          <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
        </span>
      </div>
      {children}
    </div>
  );
}

function Person({ name, trailing }: { name: string; trailing?: ReactNode }) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px]">
      <Avatar name={name} size={18} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {trailing}
    </div>
  );
}

function FileRow({ path, additions, deletions, added }: { path: string; additions: number; deletions: number; added: boolean }) {
  const slash = path.lastIndexOf('/');
  return (
    <div className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12px]">
      <span className={cx('size-1.5 shrink-0 rounded-full', added ? 'bg-success' : 'bg-warning')} />
      <span className="min-w-0 flex-1 truncate font-mono">
        <span className="text-subtle">{path.slice(0, slash + 1)}</span>
        {path.slice(slash + 1)}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums">
        <span className="text-success">+{additions}</span> <span className="text-danger">−{deletions}</span>
      </span>
    </div>
  );
}

