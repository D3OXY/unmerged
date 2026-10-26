import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { gql } from '@/github/client';
import { cx } from '@/lib/cx';
import { useDebounced } from '@/lib/useDebounced';
import { caretPoint } from './mention';
import { Avatar } from './primitives';

const MENTIONABLE_QUERY = /* GraphQL */ `
  query Mentionable($owner: String!, $name: String!, $q: String!) {
    repository(owner: $owner, name: $name) { mentionableUsers(first: 8, query: $q) { nodes { login name avatarUrl } } }
  }
`;

export type Mentionable = { login: string; name: string | null; avatarUrl: string };

/**
 * People who can be mentioned in `repo` ("owner/name") whose login or name matches `query`: GitHub's search,
 * asked once the typing pauses. Empty while no mention is typed (`query` undefined or '').
 */
export function useMentionable(repo: string | undefined, query: string | undefined) {
  const q = useDebounced(query ?? '', 150);
  const [owner, name] = repo?.split('/') ?? [];
  const people = useQuery({
    queryKey: ['mentionable', repo, q],
    queryFn: async ({ signal }) =>
      (await gql<{ repository: { mentionableUsers: { nodes: Mentionable[] } } | null }>(MENTIONABLE_QUERY, { owner, name, q }, false, signal)).repository
        ?.mentionableUsers.nodes ?? [],
    enabled: !!repo && !!q,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  return query ? (people.data ?? []) : [];
}

const MAX_HEIGHT = 280;

/**
 * The suggestions for an @mention, under the caret (above it near the window's bottom). Portaled like Menu's
 * panel, so a card's overflow can't clip it. The textarea keeps focus: it moves `active` with the arrow keys
 * and picks with Enter or Tab (see CommentBox); a click picks too.
 */
export function MentionList({ id, textarea, at, people, active, onPick }: {
  id: string;
  textarea: HTMLTextAreaElement;
  /** Where the mention's "@" is in the text. */
  at: number;
  people: Mentionable[];
  active: number;
  onPick: (login: string) => void;
}) {
  const [place, setPlace] = useState<{ left: number; top?: number; bottom?: number }>();
  useLayoutEffect(() => {
    const update = () => {
      const point = caretPoint(textarea, at);
      const below = point.bottom + 4 + MAX_HEIGHT <= window.innerHeight || point.top < MAX_HEIGHT;
      setPlace(below ? { left: point.left, top: point.bottom + 4 } : { left: point.left, bottom: window.innerHeight - point.top + 4 });
    };
    update();
    // Scrolls inside the shadow root aren't composed, so they never reach window.
    const root = textarea.getRootNode();
    root.addEventListener('scroll', update, true);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      root.removeEventListener('scroll', update, true);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [textarea, at]);

  if (!place) return null;
  return createPortal(
    <ul
      id={id}
      role="listbox"
      aria-label="Suggested people"
      style={{ ...place, maxHeight: MAX_HEIGHT }}
      className="fixed z-[60] w-64 animate-pop overflow-y-auto rounded-xl border border-line-strong bg-elevated p-1 shadow-2xl shadow-black/30"
    >
      {people.map((person, i) => (
        <li
          key={person.login}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          // Keeps focus in the textarea, so the pick lands where the caret is.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(person.login)}
          className={cx('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]', i === active ? 'bg-hover' : 'hover:bg-hover')}
        >
          <Avatar src={person.avatarUrl} size={18} />
          <span className="font-medium">{person.login}</span>
          {person.name && <span className="min-w-0 truncate text-muted">{person.name}</span>}
        </li>
      ))}
    </ul>,
    textarea.closest('.u-root') ?? textarea.parentElement!,
  );
}
