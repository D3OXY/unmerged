import { describe, expect, it } from 'vitest';
import { toTag, type TagRef } from './query';

const commit = { oid: 'a1b2c3d4', abbreviatedOid: 'a1b2c3d', committedDate: '2026-01-02T00:00:00Z', messageHeadline: 'Bump version', author: { name: 'Ada', user: null } };

// Lightweight and annotated tags reach the pages in one shape: the tagger and its date win over the commit's.
describe('toTag', () => {
  it('reads a lightweight tag from its commit', () => {
    expect(toTag({ name: 'v1', target: { __typename: 'Commit', ...commit } })).toEqual({
      name: 'v1',
      commit: { oid: 'a1b2c3d4', abbreviatedOid: 'a1b2c3d', messageHeadline: 'Bump version' },
      date: '2026-01-02T00:00:00Z',
      by: { name: 'Ada', user: null },
      message: null,
    });
  });

  it('reads an annotated tag from its tagger and message', () => {
    const tagger = { name: 'Lin', date: '2026-01-03T00:00:00Z', user: { login: 'lin', avatarUrl: 'a' } };
    const ref: TagRef = { name: 'v2', target: { __typename: 'Tag', message: 'Release 2\n', tagger, target: commit } };
    expect(toTag(ref)).toMatchObject({ commit: { oid: 'a1b2c3d4' }, date: tagger.date, by: { name: 'Lin', user: tagger.user }, message: 'Release 2' });
  });

  it('has no commit for a tag of a tree', () => {
    expect(toTag({ name: 'keys', target: { __typename: 'Tag', message: '', tagger: null, target: {} } })).toEqual({ name: 'keys', commit: null, date: null, by: null, message: null });
  });
});
