import { useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, CheckmarkCircle02Icon, FileCodeIcon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { useDraft } from '@/lib/drafts';
import { timeAgo } from '@/lib/time';
import { Button } from '@/ui/Button';
import { CommentBox } from '@/ui/CommentBox';
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
  const toggle = usePrMutation(queryKey);
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
                    {comment.state === 'PENDING' && <Pill className="ml-1.5 h-[18px] border-warning/40 text-warning">Pending</Pill>}
                  </div>
                  <Markdown html={comment.bodyHTML} className="text-[13px]" />
                </div>
              </div>
            ))}
          </div>
          {thread.viewerCanReply && <ThreadReply thread={thread} queryKey={queryKey} />}
        </>
      )}
    </div>
  );
}

/** Reply box under a thread; its draft is kept per thread. */
function ThreadReply({ thread, queryKey }: { thread: ReviewThread; queryKey: QueryKey }) {
  const [reply, setReply, clearReply] = useDraft(thread.id);
  const send = usePrMutation(queryKey);
  const text = reply.trim();
  const submit = () => {
    if (text) send.mutate({ query: MUTATIONS.replyToThread, variables: { id: thread.id, body: text } }, { onSuccess: clearReply });
  };

  return (
    <div className="border-t border-line p-2.5">
      <CommentBox value={reply} onChange={setReply} onSubmit={submit} rows={2} placeholder="Reply…" className="bg-bg">
        <Button size="sm" variant="primary" disabled={!text} loading={send.isPending} onClick={submit} className="ml-auto">
          Reply
        </Button>
      </CommentBox>
    </div>
  );
}
