import { useEffect, useRef } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { CircleDotIcon, SquareLock01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useDraft } from '@/lib/drafts';
import { createStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { CommentBox } from '@/ui/CommentBox';
import { Kbd, Pill } from '@/ui/primitives';
import { MUTATIONS, repoPath, type PrWithReview } from './query';
import { usePrMutation } from './usePrMutation';

export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';

const REVIEWED: Record<ReviewEvent, string> = { COMMENT: 'Review submitted', APPROVE: 'Approved', REQUEST_CHANGES: 'Changes requested' };

/** How a lock's reason reads in a sentence ("locked as too heated"). */
export const LOCK_REASON = { OFF_TOPIC: 'off-topic', TOO_HEATED: 'too heated', RESOLVED: 'resolved', SPAM: 'spam' };

/** Text that "Quote reply" sends to the composer of pull request `prId`. The composer takes it and clears it. */
const quoted = createStore<{ prId: string; text: string } | null>(null);

/** `markdown` as a Markdown quote, with a blank line after it for the reply. */
export const quoteOf = (markdown: string) => `${markdown.trim().split('\n').map((line) => `> ${line}`).join('\n')}\n\n`;

/** Quotes `markdown` (a comment's source) into the pull request's comment box, where the reply is written. */
export const quoteReply = (prId: string, markdown: string) => quoted.set({ prId, text: quoteOf(markdown) });

/**
 * Submitting a review: the viewer's pending one (with its line comments) if there is one, else a new review.
 * The Conversation tab's composer and the Files changed tab's "Review" panel share it, and the summary draft.
 */
export function useReview(pr: PrWithReview, queryKey: QueryKey) {
  const [body, setBody, clearBody] = useDraft(pr.id);
  const review = usePrMutation(queryKey);
  const discard = usePrMutation(queryKey);
  const pending = pr.viewerPendingReview?.nodes[0];
  const pendingCount = pending?.comments.totalCount ?? 0;
  const text = body.trim();
  const send = (event: ReviewEvent, onSent?: () => void) =>
    review.mutate(
      {
        // A pending review is submitted with the verdict; otherwise the verdict is a review of its own.
        query: pending ? MUTATIONS.submitReview : MUTATIONS.addReview,
        variables: { id: pending?.id ?? pr.id, event, body: text || undefined },
        success: REVIEWED[event],
        nextAfter: event === 'COMMENT' ? undefined : pr.url,
      },
      {
        onSuccess: () => {
          clearBody();
          onSent?.();
        },
      },
    );
  const discardPending = () => {
    if (pending && confirm(`Discard your pending review and its ${pendingCount} comment${pendingCount === 1 ? '' : 's'}?`)) {
      discard.mutate({ query: MUTATIONS.discardReview, variables: { id: pending.id }, success: 'Pending review discarded' });
    }
  };
  /** Which verdict is on its way, for its button's spinner. */
  const sending = review.isPending ? (review.variables.variables.event as ReviewEvent) : undefined;
  return { body, setBody, clearBody, text, pending, pendingCount, send, sending, discardPending, discarding: discard.isPending };
}

/**
 * Comment box with review verdicts for reviewers and close/reopen for maintainers. While the viewer has a
 * pending review (line comments added with "Add to review", here or on GitHub), ⌘↵ submits it instead,
 * with the text as its summary. "Quote reply" on a comment writes into this box.
 */
export function Composer({ pr, queryKey }: { pr: PrWithReview; queryKey: QueryKey }) {
  const { body, setBody, clearBody, text, pending, pendingCount, send: sendReview, sending, discardPending, discarding } = useReview(pr, queryKey);
  const comment = usePrMutation(queryKey);
  const toggleState = usePrMutation(queryKey);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const canReview = pr.state === 'OPEN' && !pr.viewerDidAuthor;
  // A pending review can go out without a summary if it has comments; a plain comment needs text.
  const canSend = pending ? !!(text || pendingCount) : !!text;

  const quote = quoted.use();
  useEffect(() => {
    if (quote?.prId !== pr.id) return;
    quoted.set(null);
    setBody(`${body && !body.endsWith('\n') ? `${body}\n\n` : body}${quote.text}`);
    const el = textarea.current;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
    // Only a new quote matters; the body is read as it is then.
  }, [quote, pr.id]);

  const send = () => {
    if (!canSend) return;
    if (pending) sendReview('COMMENT');
    else comment.mutate({ query: MUTATIONS.addComment, variables: { id: pr.id, body: text } }, { onSuccess: clearBody });
  };
  // With text in the box, closing or reopening sends it first, as GitHub's "Close with comment" does.
  const toggle = async () => {
    const closing = pr.state === 'OPEN';
    if (text && !pending) {
      // A failed comment was toasted; the state stays as it is.
      const sent = await comment.mutateAsync({ query: MUTATIONS.addComment, variables: { id: pr.id, body: text } }).then(() => true, () => false);
      if (!sent) return;
      clearBody();
    }
    toggleState.mutate({ query: closing ? MUTATIONS.close : MUTATIONS.reopen, variables: { id: pr.id }, success: closing ? 'Pull request closed' : 'Pull request reopened' });
  };

  return (
    <div className="flex flex-col gap-2">
      {pr.locked && (
        <p className="flex items-center gap-2 px-1 text-[12.5px] text-muted">
          <HugeiconsIcon icon={SquareLock01Icon} className="size-3.5 shrink-0" />
          This conversation is locked{pr.activeLockReason && ` as ${LOCK_REASON[pr.activeLockReason]}`}. Only people with write access can comment.
        </p>
      )}
      <CommentBox
        value={body}
        onChange={setBody}
        onSubmit={send}
        rows={4}
        textareaRef={textarea}
        preview={repoPath(pr)}
        placeholder={pending ? 'Summarize your review… (optional)' : 'Leave a comment… Markdown supported'}
      >
        {pr.viewerCanUpdate && pr.state !== 'MERGED' && (
          <Button size="sm" variant="ghost" loading={toggleState.isPending} onClick={toggle}>
            {pr.state === 'OPEN' ? (text && !pending ? 'Close with comment' : 'Close pull request') : text && !pending ? 'Reopen with comment' : 'Reopen'}
          </Button>
        )}
        {pending && (
          <Pill className="gap-1 border-warning/40 pr-1 text-warning">
            {pendingCount} pending comment{pendingCount === 1 ? '' : 's'}
            <button type="button" onClick={discardPending} disabled={discarding} className="cursor-pointer rounded px-1 text-muted hover:text-danger">
              Discard
            </button>
          </Pill>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canReview && (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={!text && !pendingCount}
                loading={sending === 'REQUEST_CHANGES'}
                icon={<HugeiconsIcon icon={CircleDotIcon} className="size-3.5" />}
                onClick={() => sendReview('REQUEST_CHANGES')}
              >
                Request changes
              </Button>
              <Button size="sm" variant="success" loading={sending === 'APPROVE'} icon={<HugeiconsIcon icon={Tick02Icon} className="size-3.5" />} onClick={() => sendReview('APPROVE')}>
                Approve
              </Button>
            </>
          )}
          <Button size="sm" variant="primary" disabled={!canSend} loading={pending ? sending === 'COMMENT' : comment.isPending} onClick={send}>
            {pending ? 'Submit review' : 'Comment'}
            <span className="flex gap-0.5 opacity-70">
              <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">⌘</Kbd>
              <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">↵</Kbd>
            </span>
          </Button>
        </div>
      </CommentBox>
    </div>
  );
}
