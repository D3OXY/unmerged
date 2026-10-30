import { describe, expect, it } from 'vitest';
import { commitsIn, rangeFor, rangeHead, type PickerCommit } from './range';

// a1 (on the base commit 000) → b2 → c3 → d4
const commits = [
  ['a1', '000'],
  ['b2', 'a1'],
  ['c3', 'b2'],
  ['d4', 'c3'],
].map(([oid, parent]) => ({ oid: `${oid}aaaaaaa`, parents: { nodes: [{ oid: `${parent}aaaaaaa` }] } }) as PickerCommit);
const sha = (i: number) => commits[i]!.oid;

describe('rangeFor', () => {
  it('is one commit alone, else the changes since the commit before the first', () => {
    expect(rangeFor(commits, 2, 2)).toBe(sha(2));
    expect(rangeFor(commits, 1, 3)).toBe(`${sha(0)}..${sha(3)}`);
    expect(rangeFor(commits, 3, 1)).toBe(`${sha(0)}..${sha(3)}`);
    expect(rangeFor(commits, 0, 1)).toBe(`000aaaaaaa..${sha(1)}`);
  });
});

describe('commitsIn', () => {
  it('finds the commits a range shows', () => {
    expect(commitsIn(commits, sha(2))).toEqual([2]);
    expect(commitsIn(commits, `${sha(0)}..${sha(3)}`)).toEqual([1, 2, 3]);
    expect(commitsIn(commits, `000aaaa..${sha(1).slice(0, 7)}`)).toEqual([0, 1]);
  });

  it('is empty for commits it doesn’t list', () => {
    expect(commitsIn(commits, 'fffffff')).toEqual([]);
    expect(commitsIn(commits, `fffffff..${sha(3)}`)).toEqual([]);
    expect(commitsIn(commits, `${sha(3)}..${sha(1)}`)).toEqual([]);
  });

  it('round-trips with rangeFor', () => {
    expect(commitsIn(commits, rangeFor(commits, 0, 2)!)).toEqual([0, 1, 2]);
  });
});

it('rangeHead is the commit a range shows the files at', () => {
  expect(rangeHead('abc1234')).toBe('abc1234');
  expect(rangeHead('abc1234..def5678')).toBe('def5678');
});
