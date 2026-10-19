import { describe, expect, it } from 'vitest';
import { mergeTimeline, type IssueComment, type IssueTimelineItem } from './query';

const comment = (id: string, createdAt: string): IssueComment => ({ __typename: 'IssueComment', id, author: null, bodyHTML: `<p>${id}</p>`, createdAt });
const reopened = (id: string, createdAt: string): IssueTimelineItem => ({ __typename: 'ReopenedEvent', id, actor: null, createdAt });

describe('mergeTimeline', () => {
  const c2 = comment('c2', '2024-01-03T00:00:00Z');
  const c3 = comment('c3', '2024-01-04T00:00:00Z');
  const newest = [c2, c3];

  it('shows the newest comments, with the older count unknown, until the timeline loads', () => {
    expect(mergeTimeline(newest, undefined)).toEqual({ items: newest });
  });

  it('shows the timeline once it loads, without the newest comments twice', () => {
    const nodes = [comment('c1', '2024-01-01T00:00:00Z'), reopened('e1', '2024-01-02T00:00:00Z'), ...newest];
    expect(mergeTimeline(newest, { totalCount: 9, nodes })).toEqual({ items: nodes, hidden: 5 });
  });

  it('adds comments newer than a stored timeline after it', () => {
    const nodes = [comment('c1', '2024-01-01T00:00:00Z'), c2];
    expect(mergeTimeline(newest, { totalCount: 2, nodes })).toEqual({ items: [...nodes, c3], hidden: 0 });
  });

  it('leaves out a comment that a newer timeline no longer has', () => {
    const nodes = [c3, reopened('e2', '2024-01-05T00:00:00Z')];
    expect(mergeTimeline(newest, { totalCount: 2, nodes }).items).toEqual(nodes);
  });
});
