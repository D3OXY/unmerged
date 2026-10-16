import { useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, PencilEdit02Icon, SmilePlusIcon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Markdown } from '@/ui/primitives';
import { EDIT_MUTATIONS, type CommentFields, type ReactionContent } from './query';
import { usePrMutation } from './usePrMutation';

// What each kind of comment saves and deletes with. The description can be edited but not deleted.
const EDIT: Record<'pr' | 'comment' | 'reviewComment', { update: string; remove?: string }> = {
  pr: { update: EDIT_MUTATIONS.updateBody },
  comment: { update: EDIT_MUTATIONS.updateComment, remove: EDIT_MUTATIONS.deleteComment },
  reviewComment: { update: EDIT_MUTATIONS.updateReviewComment, remove: EDIT_MUTATIONS.deleteReviewComment },
};

/** A comment (or the PR description) that CommentBody can edit, delete and react to. */
export type Editable = { kind: keyof typeof EDIT; node: CommentFields; queryKey: QueryKey };

/** Rendered markdown with its reactions, plus edit and delete for whoever GitHub allows. */
export function CommentBody({ html, kind, node, queryKey, className }: Editable & { html: string; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = usePrMutation(queryKey);
  const remove = usePrMutation(queryKey);
  const { update, remove: removeQuery } = EDIT[kind];

  if (draft !== null) {
    const submit = () => save.mutate({ query: update, variables: { id: node.id, body: draft } }, { onSuccess: () => setDraft(null) });
    return (
      <div>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null);
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={Math.min(20, Math.max(4, draft.split('\n').length + 1))}
          className="block w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none focus:border-accent/60"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" disabled={kind !== 'pr' && !draft.trim()} loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  const canDelete = removeQuery && node.viewerCanDelete;
  return (
    <div className="group/comment">
      {html ? <Markdown html={html} className={className} /> : <span className="text-subtle italic">No description provided.</span>}
      {(node.viewerCanReact || node.viewerCanUpdate || canDelete || node.reactionGroups.some((g) => g.reactors.totalCount > 0)) && (
        <div className="mt-2 flex items-center gap-1">
          <Reactions node={node} queryKey={queryKey} />
          <div className="ml-auto flex opacity-0 transition-opacity group-focus-within/comment:opacity-100 group-hover/comment:opacity-100">
            {node.viewerCanUpdate && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit"
                title="Edit"
                icon={<HugeiconsIcon icon={PencilEdit02Icon} className="size-3.5" />}
                onClick={() => setDraft(node.body)}
              />
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete"
                title="Delete"
                loading={remove.isPending}
                icon={<HugeiconsIcon icon={Delete02Icon} className="size-3.5" />}
                onClick={() => {
                  if (confirm('Delete this comment?')) remove.mutate({ query: removeQuery, variables: { id: node.id }, success: 'Comment deleted' });
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const EMOJI: Record<ReactionContent, [emoji: string, name: string]> = {
  THUMBS_UP: ['👍', '+1'],
  THUMBS_DOWN: ['👎', '-1'],
  LAUGH: ['😄', 'Laugh'],
  HOORAY: ['🎉', 'Hooray'],
  CONFUSED: ['😕', 'Confused'],
  HEART: ['❤️', 'Heart'],
  ROCKET: ['🚀', 'Rocket'],
  EYES: ['👀', 'Eyes'],
};
const OPTIONS = (Object.keys(EMOJI) as ReactionContent[]).map((value): MenuOption<ReactionContent> => ({ value, label: EMOJI[value].join('  ') }));

/** Reaction counts as chips; clicking one (or picking from the smiley menu) toggles yours at once. */
function Reactions({ node, queryKey }: { node: CommentFields; queryKey: QueryKey }) {
  const react = usePrMutation(queryKey);
  // Toggles still waiting for the PR refetch. A new `reactionGroups` (the refetch landed) clears them.
  const [pending, setPending] = useState({ groups: node.reactionGroups, flipped: [] as ReactionContent[] });
  const flipped = pending.groups === node.reactionGroups ? pending.flipped : [];

  const reactions = node.reactionGroups.map(({ content, viewerHasReacted, reactors }) => {
    const flip = flipped.includes(content);
    const reacted = viewerHasReacted !== flip;
    return { content, reacted, count: reactors.totalCount + (flip ? (reacted ? 1 : -1) : 0) };
  });

  const toggle = (content: ReactionContent) => {
    if (!node.viewerCanReact) return;
    const reacted = reactions.find((r) => r.content === content)?.reacted;
    setPending({ groups: node.reactionGroups, flipped: flipped.includes(content) ? flipped.filter((c) => c !== content) : [...flipped, content] });
    react.mutate(
      { query: reacted ? EDIT_MUTATIONS.removeReaction : EDIT_MUTATIONS.addReaction, variables: { id: node.id, content } },
      { onError: () => setPending({ groups: node.reactionGroups, flipped: [] }) },
    );
  };

  return (
    <>
      {reactions
        .filter((r) => r.count > 0)
        .map((r) => (
          <button
            key={r.content}
            type="button"
            disabled={!node.viewerCanReact}
            title={EMOJI[r.content][1]}
            aria-pressed={r.reacted}
            onClick={() => toggle(r.content)}
            className={cx(
              'flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-[12px] tabular-nums disabled:cursor-default',
              r.reacted ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-strong',
            )}
          >
            {EMOJI[r.content][0]} {r.count}
          </button>
        ))}
      {node.viewerCanReact && (
        <Menu<ReactionContent>
          align="left"
          value={reactions.filter((r) => r.reacted).map((r) => r.content)}
          options={OPTIONS}
          onChange={toggle}
          trigger={(open) => (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Add reaction"
              title="Add reaction"
              icon={<HugeiconsIcon icon={SmilePlusIcon} className="size-3.5" />}
              onClick={open}
              className="size-6"
            />
          )}
        />
      )}
    </>
  );
}
