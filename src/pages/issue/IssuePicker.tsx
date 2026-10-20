import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { gql } from '@/github/client';
import { useDebounced } from '@/lib/useDebounced';
import { Menu, type MenuOption } from '@/ui/Menu';
import { candidateSearch, type CandidateKind } from './relations';

const CANDIDATE = 'id number title repository { nameWithOwner }';
// GitHub reads closing keywords only in a pull request into the default branch, so only those can be linked.
const PR_CANDIDATE = `${CANDIDATE} viewerCanUpdate baseRefName repository { defaultBranchRef { name } }`;

const CANDIDATES_QUERY = /* GraphQL */ `
  query IssuePickerCandidates($q: String!, $owner: String!, $repo: String!, $number: Int!, $byNumber: Boolean!) {
    search(type: ISSUE, query: $q, first: 20) {
      nodes { __typename ... on Issue { ${CANDIDATE} } ... on PullRequest { ${PR_CANDIDATE} } }
    }
    repository(owner: $owner, name: $repo) @include(if: $byNumber) {
      issueOrPullRequest(number: $number) {
        __typename ... on Issue { ${CANDIDATE} } ... on PullRequest { ${PR_CANDIDATE} }
      }
    }
  }
`;

type Candidate = {
  __typename: 'Issue' | 'PullRequest';
  id: string;
  number: number;
  title: string;
  // These three are for pull requests only.
  viewerCanUpdate?: boolean;
  baseRefName?: string;
  repository: { defaultBranchRef?: { name: string } | null };
};
type Candidates = { search: { nodes: Candidate[] }; repository?: { issueOrPullRequest: Candidate | null } | null };

/**
 * A "+" that opens a search over `repo`'s issues or pull requests (`kind`) and calls `onPick` with the chosen
 * one. Pull requests the viewer can't edit or that aren't into the default branch, and the ids in `hide`, aren't
 * offered. Results load once
 * the menu first opens, not on every page view.
 */
export function IssuePicker({ repo, kind, title, hide, onPick }: {
  repo: string;
  kind: CandidateKind;
  title: string;
  hide: string[];
  onPick: (picked: { id: string; number: number }) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [text, setText] = useState('');
  const search = useDebounced(text, 200);
  const candidates = useQuery({
    queryKey: ['issue-picker', repo.toLowerCase(), kind, search.trim()],
    queryFn: async () => {
      const { q, number } = candidateSearch(kind, repo, search);
      const [owner, name] = repo.split('/');
      const data = await gql<Candidates>(CANDIDATES_QUERY, { q, owner, repo: name, number: number ?? 0, byNumber: number !== undefined });
      const typename = kind === 'pr' ? 'PullRequest' : 'Issue';
      const exact = data.repository?.issueOrPullRequest;
      return [...(exact ? [exact] : []), ...data.search.nodes].filter(
        (node) => node.__typename === typename && (kind !== 'pr' || (node.viewerCanUpdate && node.baseRefName === node.repository.defaultBranchRef?.name)),
      );
    },
    enabled: opened,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const options = (candidates.data ?? [])
    .filter((c, i, all) => !hide.includes(c.id) && all.findIndex((o) => o.id === c.id) === i)
    .map((c): MenuOption<string> => ({ value: c.id, label: `#${c.number} ${c.title}` }));

  return (
    <Menu<string>
      value=""
      options={options}
      onChange={(id) => {
        const picked = candidates.data?.find((c) => c.id === id);
        if (picked) onPick(picked);
      }}
      header={
        <div className="p-1 pb-1.5">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'pr' ? 'Search pull requests' : 'Search issues'}
            className="h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[12.5px] outline-none focus:border-accent/60"
          />
          {options.length === 0 && <p className="px-1.5 pt-2 text-[12px] text-subtle">{candidates.isError ? 'Search failed' : candidates.data && !candidates.isFetching ? 'No matches' : 'Searching…'}</p>}
        </div>
      }
      trigger={(open) => (
        <button
          type="button"
          aria-label={title}
          title={title}
          onClick={() => {
            setOpened(true);
            open();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-subtle hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
        </button>
      )}
    />
  );
}
