import { describe, expect, it } from 'vitest';
import { withFlips } from './CommentBody';
import type { ReactionGroup } from './query';

const groups: ReactionGroup[] = [
  { content: 'THUMBS_UP', viewerHasReacted: false, reactors: { totalCount: 2 } },
  { content: 'HEART', viewerHasReacted: true, reactors: { totalCount: 1 } },
  { content: 'EYES', viewerHasReacted: false, reactors: { totalCount: 0 } },
];

describe('withFlips', () => {
  it("shows GitHub's counts when nothing is pending", () => {
    expect(withFlips(groups, [])).toEqual([
      { content: 'THUMBS_UP', reacted: false, count: 2 },
      { content: 'HEART', reacted: true, count: 1 },
      { content: 'EYES', reacted: false, count: 0 },
    ]);
  });

  it('adds a reaction the viewer just toggled on and removes one toggled off', () => {
    expect(withFlips(groups, ['THUMBS_UP', 'HEART', 'EYES'])).toEqual([
      { content: 'THUMBS_UP', reacted: true, count: 3 },
      { content: 'HEART', reacted: false, count: 0 },
      { content: 'EYES', reacted: true, count: 1 },
    ]);
  });
});
