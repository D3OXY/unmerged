import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { useDraft } from '@/lib/drafts';
import { MUTATIONS } from '@/pages/pr/query';
import { usePrMutation } from '@/pages/pr/usePrMutation';
import { Button } from '@/ui/Button';
import { CommentBox } from '@/ui/CommentBox';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Kbd } from '@/ui/primitives';
import { IssueIcon } from '@/ui/status';
import { stateChange, type ClosedReason, type Issue } from './query';

export const CLOSE_REASONS: MenuOption<ClosedReason>[] = [
  { value: 'COMPLETED', label: 'Close as completed', hint: 'Done, fixed or resolved' },
  { value: 'NOT_PLANNED', label: 'Close as not planned', hint: "Won't fix, can't reproduce, stale" },
];

/** Comment box with close (as completed or not planned) and reopen. ⌘↵ comments. */
export function IssueComposer({ issue, queryKey }: { issue: Issue; queryKey: QueryKey }) {
  const [body, setBody, clearBody] = useDraft(issue.id);
  const comment = usePrMutation(queryKey);
  const toggleState = usePrMutation(queryKey);
  const text = body.trim();

  const send = () => {
    if (!text) return;
    comment.mutate({ query: MUTATIONS.addComment, variables: { id: issue.id, body: text } }, { onSuccess: clearBody });
  };

  return (
    <CommentBox value={body} onChange={setBody} onSubmit={send} rows={4} placeholder="Leave a comment… Markdown supported">
      {issue.state === 'OPEN' && issue.viewerCanClose && (
        <Menu<ClosedReason>
          align="left"
          value="COMPLETED"
          options={CLOSE_REASONS}
          onChange={(reason) => toggleState.mutate(stateChange(issue.id, reason))}
          trigger={(open) => (
            <Button size="sm" variant="ghost" loading={toggleState.isPending} icon={<IssueIcon state="CLOSED" className="size-3.5" />} onClick={open}>
              Close issue
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
            </Button>
          )}
        />
      )}
      {issue.state === 'CLOSED' && issue.viewerCanReopen && (
        <Button size="sm" variant="ghost" loading={toggleState.isPending} icon={<IssueIcon className="size-3.5" />} onClick={() => toggleState.mutate(stateChange(issue.id))}>
          Reopen issue
        </Button>
      )}
      <Button className="ml-auto" size="sm" variant="primary" disabled={!text} loading={comment.isPending} onClick={send}>
        Comment
        <span className="flex gap-0.5 opacity-70">
          <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">⌘</Kbd>
          <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">↵</Kbd>
        </span>
      </Button>
    </CommentBox>
  );
}
