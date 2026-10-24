import { describe, expect, it } from 'vitest';
import { branchLists, indexStaleTime, toBranch, type BranchEntry, type BranchNode } from './query';

const node = (compare: BranchNode['compare'], pr: BranchNode['associatedPullRequests']['nodes'] = []): BranchNode => ({
  id: 'R1',
  target: { oid: 'abc', statusCheckRollup: null },
  associatedPullRequests: { nodes: pr },
  compare,
});

describe('toBranch', () => {
  // GitHub compares from the branch to the default branch, so its aheadBy is the default branch's lead.
  it('reads ahead and behind from the branch’s side', () => {
    expect(toBranch(node({ aheadBy: 2498, behindBy: 2 }))).toMatchObject({ ahead: 2, behind: 2498 });
  });

  it('keeps the latest pull request, or none', () => {
    expect(toBranch(node(null, [{ number: 7, state: 'OPEN', isDraft: false }]))).toMatchObject({ pr: { number: 7 }, ahead: 0, behind: 0 });
    expect(toBranch(node(null)).pr).toBeNull();
  });
});

describe('branchLists', () => {
  const now = Date.parse('2026-10-17T00:00:00Z');
  const entry = (name: string, daysAgo: number, login: string | null): BranchEntry => ({
    name,
    committedDate: new Date(now - daysAgo * 86_400_000).toISOString(),
    author: { name: login, user: login === null ? null : { login, avatarUrl: '' } },
  });
  // In GitHub's order, by name: dates only sort here.
  const entries = [entry('zed', 200, 'them'), entry('mine-old', 120, 'Me'), entry('main', 0, 'them'), entry('mine', 1, 'me'), entry('bot', 30, null)];
  const names = (list: BranchEntry[]) => list.map((e) => e.name);
  const lists = branchLists(entries, 'main', 'ME', now);

  it('sorts All newest first, with the default branch', () => {
    expect(names(lists.all)).toEqual(['main', 'mine', 'bot', 'mine-old', 'zed']);
  });

  it('splits the others at three months: Active newest first, Stale oldest first', () => {
    expect(names(lists.active)).toEqual(['mine', 'bot']);
    expect(names(lists.stale)).toEqual(['zed', 'mine-old']);
  });

  it('keeps the viewer’s branches, whatever the login’s case, and none when signed out', () => {
    expect(names(lists.yours)).toEqual(['mine', 'mine-old']);
    expect(branchLists(entries, 'main', null, now).yours).toEqual([]);
  });
});

// Each 100 branches cost a request, so a return to the tab refreshes a big index less often.
describe('indexStaleTime', () => {
  it('keeps an index of more than one page fresh for longer', () => {
    expect(indexStaleTime(undefined)).toBe(30_000);
    expect(indexStaleTime({ entries: [], total: 100 })).toBe(30_000);
    expect(indexStaleTime({ entries: [], total: 101 })).toBe(10 * 60_000);
  });
});
