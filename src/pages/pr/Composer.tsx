import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { CircleDotIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useDraft } from '@/lib/drafts';
import { Button } from '@/ui/Button';
import { CommentBox } from '@/ui/CommentBox';
import { Kbd, Pill } from '@/ui/primitives';
import { MUTATIONS, type PrWithReview } from './query';
import { usePrMutation } from './usePrMutation';

type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';

const REVIEWED: Record<ReviewEvent, string> = { COMMENT: 'Review submitted', APPROVE: 'Approved', REQUEST_CHANGES: 'Changes requested' };

/**
 * Comment box with review verdicts for reviewers and close/reopen for maintainers. While the viewer has a
 * pending review (line comments added with "Add to review", here or on GitHub), ⌘↵ submits it instead,
 * with the text as its summary.
 */
export function Composer({ pr, queryKey }: { pr: PrWithReview; queryKey: QueryKey }) {
  const [body, setBody, clearBody] = useDraft(pr.id);
  const comment = usePrMutation(queryKey);
  const review = usePrMutation(queryKey);
  const toggleState = usePrMutation(queryKey);
  const pending = pr.viewerPendingReview?.nodes[0];
  const pendingCount = pending?.comments.totalCount ?? 0;
  const canReview = pr.state === 'OPEN' && !pr.viewerDidAuthor;
  const text = body.trim();
  // A pending review can go out without a summary if it has comments; a plain comment needs text.
  const canSend = pending ? !!(text || pendingCount) : !!text;

  const sendReview = (event: ReviewEvent) =>
    review.mutate(
      {
        // A pending review is submitted with the verdict; otherwise the verdict is a review of its own.
        query: pending ? MUTATIONS.submitReview : MUTATIONS.addReview,
        variables: { id: pending?.id ?? pr.id, event, body: text || undefined },
        success: REVIEWED[event],
        nextAfter: event === 'COMMENT' ? undefined : pr.url,
      },
      { onSuccess: clearBody },
    );
  const send = () => {
    if (!canSend) return;
    if (pending) sendReview('COMMENT');
    else comment.mutate({ query: MUTATIONS.addComment, variables: { id: pr.id, body: text } }, { onSuccess: clearBody });
  };

  return (
    <CommentBox value={body} onChange={setBody} onSubmit={send} rows={4} placeholder={pending ? 'Summarize your review… (optional)' : 'Leave a comment… Markdown supported'}>
      {pr.viewerCanUpdate && pr.state !== 'MERGED' && (
        <Button
          size="sm"
          variant="ghost"
          loading={toggleState.isPending}
          onClick={() =>
            toggleState.mutate({
              query: pr.state === 'OPEN' ? MUTATIONS.close : MUTATIONS.reopen,
              variables: { id: pr.id },
              success: pr.state === 'OPEN' ? 'Pull request closed' : 'Pull request reopened',
            })
          }
        >
          {pr.state === 'OPEN' ? 'Close pull request' : 'Reopen'}
        </Button>
      )}
      {pending && (
        <Pill className="border-warning/40 text-warning">
          {pendingCount} pending comment{pendingCount === 1 ? '' : 's'}
        </Pill>
      )}
      <div className="ml-auto flex items-center gap-2">
        {canReview && (
          <>
            <Button
              size="sm"
              variant="danger"
              disabled={!text && !pendingCount}
              loading={review.isPending && review.variables?.variables.event === 'REQUEST_CHANGES'}
              icon={<HugeiconsIcon icon={CircleDotIcon} className="size-3.5" />}
              onClick={() => sendReview('REQUEST_CHANGES')}
            >
              Request changes
            </Button>
            <Button
              size="sm"
              variant="success"
              loading={review.isPending && review.variables?.variables.event === 'APPROVE'}
              icon={<HugeiconsIcon icon={Tick02Icon} className="size-3.5" />}
              onClick={() => sendReview('APPROVE')}
            >
              Approve
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={!canSend}
          loading={pending ? review.isPending && review.variables?.variables.event === 'COMMENT' : comment.isPending}
          onClick={send}
        >
          {pending ? 'Submit review' : 'Comment'}
          <span className="flex gap-0.5 opacity-70">
            <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">⌘</Kbd>
            <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">↵</Kbd>
          </span>
        </Button>
      </div>
    </CommentBox>
  );
}
