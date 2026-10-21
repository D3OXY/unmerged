import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  defaultQuery,
  detailChunks,
  detailsById,
  groupByParent,
  knownDetails,
  qualifierOf,
  repoListQuery,
  withQualifier,
  workDetailsQuery,
  workQueryOf,
  type Qualifier,
  type WorkDetails,
  type WorkItem,
} from './queries';

describe('workQueryOf', () => {
  it.each([
    ['https://github.com/pulls?q=is:pr+label:bug', 'is:pr label:bug'],
    ['https://github.com/o/r/issues?q=is:closed', 'is:closed'],
  ])("uses the URL's ?q= for %s", (url, expected) => {
    expect(workQueryOf(new URL(url), 'unused')).toBe(expected);
  });

  it.each([
    ['https://github.com/pulls/assigned', defaultQuery('pr', 'assigned'), 'is:open is:pr assignee:@me archived:false sort:updated-desc'],
    ['https://github.com/pulls/assigned?q=', defaultQuery('pr', 'assigned'), 'is:open is:pr assignee:@me archived:false sort:updated-desc'],
    ['https://github.com/o/r/issues', repoListQuery('issues'), 'is:open is:issue'],
    ['https://github.com/o/r/pulls?q=', repoListQuery('pulls'), 'is:open is:pr'],
  ])('falls back to the bare-URL search for %s', (url, fallback, expected) => {
    expect(workQueryOf(new URL(url), fallback)).toBe(expected);
  });
});

describe('withQualifier', () => {
  it.each<[string, Qualifier, string, string]>([
    // State goes first, and `state:` is GitHub's newer spelling of `is:`.
    [defaultQuery('pr', 'created'), 'state', 'is:closed', 'is:closed is:pr author:@me archived:false sort:updated-desc'],
    ['is:pr state:open  review-requested:@me', 'state', 'is:closed', 'is:closed is:pr review-requested:@me'],
    ['is:issue is:merged', 'state', 'is:open', 'is:open is:issue'],
    ['', 'state', 'is:open', 'is:open'],
    // Sort, set or removed.
    ['is:pr sort:updated-desc', 'sort', 'sort:created-asc', 'is:pr sort:created-asc'],
    ['is:pr sort:updated-desc archived:false', 'sort', '', 'is:pr archived:false'],
    // Every matching term is replaced, quoted values included; negated terms are kept.
    ['label:bug is:pr label:"good first issue" -label:wontfix', 'label', 'label:docs', 'is:pr -label:wontfix label:docs'],
    ['author:me is:pr', 'author', '', 'is:pr'],
    // The Review chip owns `review-requested:` too.
    ['is:pr review-requested:@me', 'review', 'review:approved', 'is:pr review:approved'],
    ['is:pr status:failure', 'ci', 'status:success', 'is:pr status:success'],
    // Only whole qualifiers count: a bare `author:` and a value that looks like a qualifier aren't matched.
    ['is:pr author:', 'author', 'author:x', 'is:pr author: author:x'],
    ['is:pr label:is:open', 'state', 'is:closed', 'is:closed is:pr label:is:open'],
  ])('%j, %s → %s gives %j', (q, name, token, expected) => {
    expect(withQualifier(q, name, token)).toBe(expected);
  });
});

describe('qualifierOf', () => {
  it.each<[string, Qualifier, string]>([
    ['is:pr label:"good first issue" label:bug', 'label', 'label:"good first issue"'],
    ['is:pr -label:bug', 'label', ''],
    ['state:open is:pr', 'state', 'state:open'],
    ['is:pr review-requested:@me', 'review', 'review-requested:@me'],
    ['is:pr', 'sort', ''],
  ])('%j, %s → %j', (q, name, expected) => {
    expect(qualifierOf(q, name)).toBe(expected);
  });
});

const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `ID_${from + i}`);
const issue = (id: string): WorkDetails => ({ __typename: 'Issue', id, comments: { totalCount: 1 } });

describe('detailChunks', () => {
  it('asks for 10 results a request, in list order', () => {
    expect(detailChunks(ids(23).map((id) => ({ id })))).toEqual([ids(10), ids(10, 10), ids(3, 20)]);
    expect(detailChunks([])).toEqual([]);
  });
});

describe('detailsById', () => {
  const chunks = [ids(2), ids(2, 2)];
  const done = (data: (WorkDetails | null)[]) => ({ data, isError: false, isPlaceholderData: false });
  const pending = { data: undefined, isError: false, isPlaceholderData: false };

  it('leaves out the results whose request is still running', () => {
    const byId = detailsById(chunks, [done([issue('ID_0'), issue('ID_1')]), pending]);
    expect([...byId.keys()]).toEqual(['ID_0', 'ID_1']);
  });

  it('marks as null what failed or what GitHub had nothing for', () => {
    const byId = detailsById(chunks, [done([issue('ID_0'), null]), { data: undefined, isError: true, isPlaceholderData: false }]);
    expect(Object.fromEntries(byId)).toEqual({ ID_0: issue('ID_0'), ID_1: null, ID_2: null, ID_3: null });
  });

  it('keeps an earlier answer when a refetch fails', () => {
    const byId = detailsById([ids(2)], [{ data: [issue('ID_0'), issue('ID_1')], isError: true, isPlaceholderData: false }]);
    expect(Object.fromEntries(byId)).toEqual({ ID_0: issue('ID_0'), ID_1: issue('ID_1') });
  });

  it('shows placeholder data while the rest of the request runs', () => {
    const byId = detailsById([ids(2)], [{ data: [issue('ID_1')], isError: false, isPlaceholderData: true }]);
    expect(Object.fromEntries(byId)).toEqual({ ID_1: issue('ID_1') });
  });
});

describe('knownDetails', () => {
  it('finds the details of a reordered list in the requests before it', () => {
    const client = new QueryClient();
    client.setQueryData(workDetailsQuery(['ID_0', 'ID_1']).queryKey, [issue('ID_0'), null]);
    client.setQueryData(workDetailsQuery(['ID_2']).queryKey, [issue('ID_2')]);
    expect(knownDetails(client, ['ID_2', 'ID_0', 'ID_9'])).toEqual([issue('ID_0'), issue('ID_2')]);
    expect(knownDetails(client, ['ID_9'])).toBeUndefined();
  });
});

describe('groupByParent', () => {
  const parent = (id: string) => ({ id, number: 1, title: id, url: '', state: 'OPEN' as const, stateReason: null, repository: { nameWithOwner: 'o/r' } });
  const item = (id: string, parentId?: string) => ({ __typename: 'Issue', id, parent: parentId ? parent(parentId) : null }) as WorkItem;
  const pr = (id: string) => ({ __typename: 'PullRequest', id }) as WorkItem;

  it('groups by parent in list order, with issues that have none (and pull requests) last', () => {
    const groups = groupByParent([item('a'), item('b', 'P'), pr('c'), item('d', 'Q'), item('e', 'P')]);
    expect(groups.map((group) => [group.parent?.id ?? null, group.items.map((i) => i.id)])).toEqual([
      ['P', ['b', 'e']],
      ['Q', ['d']],
      [null, ['a', 'c']],
    ]);
  });
});
