import { describe, expect, it } from 'vitest';
import { candidateSearch, relationChange, withClosingReference } from './relations';

describe('relationChange', () => {
  it('sets a parent as a sub-issue of the other issue, replacing the old parent', () => {
    expect(relationChange('parent', 'I', 'P', true).variables).toEqual({ id: 'P', sub: 'I', replace: true });
    expect(relationChange('parent', 'I', 'P', false).variables).toEqual({ id: 'P', sub: 'I' });
  });

  it('adds and removes sub-issues on the issue itself', () => {
    expect(relationChange('sub', 'I', 'S', true).variables).toEqual({ id: 'I', sub: 'S' });
    expect(relationChange('sub', 'I', 'S', false).query).toMatch(/removeSubIssue/);
  });

  it('stores blocking as the other issue being blocked by this one', () => {
    expect(relationChange('blockedBy', 'I', 'B', true).variables).toEqual({ id: 'I', blocker: 'B' });
    expect(relationChange('blocking', 'I', 'B', true).variables).toEqual({ id: 'B', blocker: 'I' });
    expect(relationChange('blocking', 'I', 'B', false).query).toMatch(/removeBlockedBy/);
  });
});

describe('withClosingReference', () => {
  it('adds the keyword on its own line after the description', () => {
    expect(withClosingReference('Fixes the list.\n', 12)).toBe('Fixes the list.\n\nCloses #12');
  });

  it('is the whole description when there was none', () => {
    expect(withClosingReference(' ', 12)).toBe('Closes #12');
  });
});

describe('candidateSearch', () => {
  it('lists recently updated open ones before the user types', () => {
    expect(candidateSearch('issue', 'o/r', '')).toEqual({ q: 'repo:o/r is:issue is:open sort:updated-desc', number: undefined });
  });

  it('looks up a number exactly, with or without #', () => {
    expect(candidateSearch('pr', 'o/r', '#42')).toEqual({ q: 'repo:o/r is:pr 42 sort:updated-desc', number: 42 });
    expect(candidateSearch('issue', 'o/r', ' 42 ').number).toBe(42);
  });

  it('searches text as typed', () => {
    expect(candidateSearch('issue', 'o/r', 'dark mode')).toEqual({ q: 'repo:o/r is:issue dark mode sort:updated-desc', number: undefined });
  });
});
