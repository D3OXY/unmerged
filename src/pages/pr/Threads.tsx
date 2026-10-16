import { useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, CheckmarkCircle02Icon, FileCodeIcon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { timeAgo } from '@/lib/time';
import { Button } from '@/ui/Button';
import { Avatar, Markdown, Pill, SectionHeader } from '@/ui/primitives';
import { MUTATIONS, type ReviewThread } from './query';
import { usePrMutation } from './usePrMutation';

/** Inline review threads pulled up into the conversation, unresolved first. */
export function Threads({ threads, queryKey }: { threads: ReviewThread[]; queryKey: QueryKey }) {
  const [showResolved, setShowResolved] = useState(false);
  const open = threads.filter((t) => !t.isResolved);
  const resolved = threads.filter((t) => t.isResolved);
  if (!threads.length) return null;

  return (
    <section>
      <SectionHeader
        title="Review threads"
        count={open.length}
        action={
          resolved.length > 0 && (
            <button type="button" onClick={() => setShowResolved((s) => !s)} className="cursor-pointer text-[12px] text-subtle hover:text-fg">
              {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
            </button>
          )
        }
      />
      <div className="flex flex-col gap-3">
        {open.length === 0 && !showResolved && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-[12.5px] text-muted">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-success" /> All {resolved.length} threads resolved
          </div>
        )}
        {[...open, ...(showResolved ? resolved : [])].map((thread) => (
          <Thread key={thread.id} thread={thread} queryKey={queryKey} />
        ))}
      </div>
    </section>
  );
}

/** One review thread. `inline` drops the file/hunk context for use inside a diff. */
export function Thread({ thread, queryKey, inline }: { thread: ReviewThread; queryKey: QueryKey; inline?: boolean }) {
  const [collapsed, setCollapsed] = useState(thread.isResolved);
  const [reply, setReply] = useState('');
  const toggle = usePrMutation(queryKey);
  const send = usePrMutation(queryKey);
  const first = thread.comments.nodes[0];
  const hunk = first?.diffHunk.split('\n').slice(-6) ?? [];

  return (
    <div className={cx('overflow-hidden rounded-xl border border-line bg-panel', thread.isResolved && 'opacity-75')}>
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex min-w-0 cursor-pointer items-center gap-2 text-left">
          <HugeiconsIcon icon={ArrowRight01Icon} className={cx('size-3.5 shrink-0 text-subtle transition-transform', !collapsed && 'rotate-90')} />
          {inline ? (
            <span className="text-[12px] text-muted">{thread.isResolved ? 'Resolved thread' : 'Thread'}</span>
          ) : (
            <>
              <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 shrink-0 text-subtle" />
              <span className="truncate font-mono text-[12px]">
                {thread.path}
                {thread.line && <span className="text-subtle">:{thread.line}</span>}
              </span>
            </>
          )}
        </button>
        {thread.isOutdated && <Pill>Outdated</Pill>}
        <span className="ml-auto text-[12px] text-subtle">{thread.comments.nodes.length} comments</span>
        {(thread.isResolved ? thread.viewerCanUnresolve : thread.viewerCanResolve) && (
          <Button
            size="sm"
            variant={thread.isResolved ? 'ghost' : 'secondary'}
            loading={toggle.isPending}
            onClick={() => toggle.mutate({ query: thread.isResolved ? MUTATIONS.unresolveThread : MUTATIONS.resolveThread, variables: { id: thread.id } })}
          >
            {thread.isResolved ? 'Unresolve' : 'Resolve'}
          </Button>
        )}
      </div>
      {!collapsed && (
        <>
          {!inline && hunk.length > 0 && (
            <pre className="overflow-x-auto border-b border-line bg-bg py-2 font-mono text-[11.5px] leading-[1.6]">
              {hunk.map((line, i) => (
                <div
                  key={i}
                  className={cx(
                    'px-4 whitespace-pre',
                    line.startsWith('+') && 'bg-success/10 text-success',
                    line.startsWith('-') && 'bg-danger/10 text-danger',
                    line.startsWith('@@') && 'text-subtle',
                  )}
                >
                  {line || ' '}
                </div>
              ))}
            </pre>
          )}
          <div className="flex flex-col divide-y divide-line">
            {thread.comments.nodes.map((comment) => (
              <div key={comment.id} className="flex gap-3 px-4 py-3">
                <Avatar src={comment.author?.avatarUrl} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[12.5px]">
                    <span className="font-semibold">{comment.author?.login}</span> <span className="text-subtle">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <Markdown html={comment.bodyHTML} className="text-[13px]" />
                </div>
              </div>
            ))}
          </div>
          {thread.viewerCanReply && (
            <form
              className="flex gap-2 border-t border-line p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (reply.trim()) send.mutate({ query: MUTATIONS.replyToThread, variables: { id: thread.id, body: reply.trim() } }, { onSuccess: () => setReply('') });
              }}
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply…"
                className="h-8 flex-1 rounded-lg border border-line bg-bg px-3 text-[12.5px] outline-none focus:border-accent/60"
              />
              <Button size="sm" type="submit" variant="primary" disabled={!reply.trim()} loading={send.isPending} className="h-8">
                Reply
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
