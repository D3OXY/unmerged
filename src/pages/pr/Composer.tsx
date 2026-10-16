import { useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { CircleDotIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/ui/Button';
import { Kbd } from '@/ui/primitives';
import { MUTATIONS, type PullRequest } from './query';
import { usePrMutation } from './usePrMutation';

/** Comment box with review verdicts for reviewers and close/reopen for maintainers. ⌘↵ comments. */
export function Composer({ pr, queryKey }: { pr: PullRequest; queryKey: QueryKey }) {
  const [body, setBody] = useState('');
  const comment = usePrMutation(queryKey);
  const review = usePrMutation(queryKey);
  const toggleState = usePrMutation(queryKey);
  const canReview = pr.state === 'OPEN' && !pr.viewerDidAuthor;
  const text = body.trim();

  const send = () => {
    if (!text) return;
    comment.mutate({ query: MUTATIONS.addComment, variables: { id: pr.id, body: text } }, { onSuccess: () => setBody('') });
  };
  const sendReview = (event: 'APPROVE' | 'REQUEST_CHANGES') =>
    review.mutate(
      { query: MUTATIONS.addReview, variables: { id: pr.id, event, body: text || undefined }, success: event === 'APPROVE' ? 'Approved' : 'Changes requested' },
      { onSuccess: () => setBody('') },
    );

  return (
    <div className="rounded-xl border border-line bg-panel focus-within:border-line-strong">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={4}
        placeholder="Leave a comment… Markdown supported"
        className="block w-full resize-y bg-transparent px-4 py-3 text-[13.5px] leading-relaxed outline-none placeholder:text-subtle"
      />
      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
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
        <div className="ml-auto flex items-center gap-2">
          {canReview && (
            <>
              <Button size="sm" variant="danger" disabled={!text} loading={review.isPending && review.variables?.variables.event === 'REQUEST_CHANGES'} icon={<HugeiconsIcon icon={CircleDotIcon} className="size-3.5" />} onClick={() => sendReview('REQUEST_CHANGES')}>
                Request changes
              </Button>
              <Button size="sm" variant="success" loading={review.isPending && review.variables?.variables.event === 'APPROVE'} icon={<HugeiconsIcon icon={Tick02Icon} className="size-3.5" />} onClick={() => sendReview('APPROVE')}>
                Approve
              </Button>
            </>
          )}
          <Button size="sm" variant="primary" disabled={!text} loading={comment.isPending} onClick={send}>
            Comment
            <span className="flex gap-0.5 opacity-70">
              <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">⌘</Kbd>
              <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">↵</Kbd>
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
