import { describe, expect, it } from 'vitest';
import { completeMention, mentionAt } from './mention';

describe('mentionAt', () => {
  it('finds the mention that ends at the caret', () => {
    expect(mentionAt('@jar', 4)).toEqual({ start: 0, query: 'jar' });
    expect(mentionAt('thanks @jarred-s', 16)).toEqual({ start: 7, query: 'jarred-s' });
    expect(mentionAt('cc (@a', 6)).toEqual({ start: 4, query: 'a' });
    expect(mentionAt('hi @', 4)).toEqual({ start: 3, query: '' });
  });

  it('ignores emails, finished mentions and text after the caret', () => {
    expect(mentionAt('me@host', 7)).toBeNull();
    expect(mentionAt('@jar ', 5)).toBeNull();
    expect(mentionAt('@jar and', 8)).toBeNull();
    expect(mentionAt('@jar', 0)).toBeNull();
  });
});

describe('completeMention', () => {
  it('replaces the typed part with the login and a space, and puts the caret after it', () => {
    expect(completeMention('hi @ja there', 6, { start: 3, query: 'ja' }, 'jarred')).toEqual({ text: 'hi @jarred there', caret: 11 });
    expect(completeMention('@j', 2, { start: 0, query: 'j' }, 'jo')).toEqual({ text: '@jo ', caret: 4 });
  });
});
