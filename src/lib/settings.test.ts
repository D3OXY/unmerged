import { describe, expect, it } from 'vitest';
import { blurredKinds, DEFAULT_PRIVACY, type Privacy } from './settings';

describe('blurredKinds', () => {
  it('blurs only email addresses by default', () => {
    expect(blurredKinds(DEFAULT_PRIVACY)).toEqual(['emails']);
  });

  it('blurs nothing while the master switch is off, whatever the kinds say', () => {
    expect(blurredKinds({ ...DEFAULT_PRIVACY, on: false })).toEqual([]);
  });

  it('leaves out the kinds switched off', () => {
    const blur = { orgs: true, repos: true, commits: false, titles: true, emails: false };
    expect(blurredKinds({ on: true, blur })).toEqual(['orgs', 'repos', 'titles']);
  });

  it('uses the default for a kind that a setting saved before it existed does not list', () => {
    const saved = { on: true, blur: { orgs: true } } as unknown as Privacy;
    expect(blurredKinds(saved)).toEqual(['orgs', 'emails']);
  });
});
