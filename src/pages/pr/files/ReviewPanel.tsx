import { useCallback, useRef, useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { CommentBox } from '@/ui/CommentBox';
import { useDismiss } from '@/ui/useDismiss';
import { useReview, type ReviewEvent } from '../Composer';
import { repoPath, type PullRequest } from '../query';

const VERDICTS: { event: ReviewEvent; label: string; hint: string }[] = [
  { event: 'COMMENT', label: 'Comment', hint: 'Feedback without an approval' },
  { event: 'APPROVE', label: 'Approve', hint: 'The changes can merge' },
  { event: 'REQUEST_CHANGES', label: 'Request changes', hint: 'The changes must be fixed before they merge' },
];

/**
 * Files changed's "Review" button: a summary and a verdict for the viewer's review, sent without a trip to
 * Conversation. It sends the pending review (the line comments added with "Start a review") if there is one.
 * The summary is the Conversation composer's draft, so text written in one shows in the other.
 */
export function ReviewPanel({ pr, queryKey }: { pr: PullRequest; queryKey: QueryKey }) {
  const [open, setOpen] = useState(false);
  const { body, setBody, text, pending, pendingCount, send, sending, discardPending, discarding } = useReview(pr, queryKey);
  const verdicts = pr.viewerDidAuthor ? VERDICTS.slice(0, 1) : VERDICTS;
  const [event, setEvent] = useState<ReviewEvent>('COMMENT');
  const ref = useRef<HTMLDivElement>(null);
  useDismiss([ref], open, useCallback(() => setOpen(false), []));
  // An approval can go out alone; a comment or a change request needs a summary or line comments, as on GitHub.
  const canSend = event === 'APPROVE' || !!text || pendingCount > 0;
  const submit = () => {
    if (canSend) send(event, () => setOpen(false));
  };

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant={pending ? 'primary' : 'secondary'} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="h-7">
        {pending ? 'Finish review' : 'Review'}
        {pendingCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">{pendingCount}</span>}
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-1.5 w-[420px] max-w-[calc(100vw-48px)] animate-pop rounded-xl border border-line-strong bg-elevated p-2 shadow-2xl shadow-black/30">
          <CommentBox autoFocus value={body} onChange={setBody} onSubmit={submit} onClose={() => setOpen(false)} rows={4} preview={repoPath(pr)} placeholder="Leave a summary… (optional)" className="bg-bg">
            {pending && (
              <Button size="sm" variant="ghost" loading={discarding} onClick={discardPending}>
                Discard
              </Button>
            )}
            <Button size="sm" variant="primary" disabled={!canSend} loading={!!sending} onClick={submit} className="ml-auto">
              Submit review
            </Button>
          </CommentBox>
          <div role="radiogroup" aria-label="Verdict" className="mt-2 flex flex-col gap-0.5">
            {verdicts.map((v) => (
              <button
                key={v.event}
                type="button"
                role="radio"
                aria-checked={event === v.event}
                onClick={() => setEvent(v.event)}
                className={cx('flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-hover', event === v.event && 'bg-hover')}
              >
                <span className={cx('mt-1 size-3 shrink-0 rounded-full border', event === v.event ? 'border-[3.5px] border-accent' : 'border-line-strong')} />
                <span>
                  <span className="block text-[12.5px] font-medium">{v.label}</span>
                  <span className="block text-[11.5px] text-muted">{v.hint}</span>
                </span>
              </button>
            ))}
          </div>
          {pr.viewerDidAuthor && <p className="px-2.5 pt-1 text-[11.5px] text-subtle">You opened this pull request, so you can only comment on it.</p>}
        </div>
      )}
    </div>
  );
}
