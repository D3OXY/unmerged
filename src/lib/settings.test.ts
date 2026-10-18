import { describe, expect, it } from 'vitest';
import { blurredKinds, DEFAULT_PRIVACY, type Privacy } from './settings';

describe('blurredKinds', () => {
  it('blurs every kind by default', () => {
    expect(blurredKinds(DEFAULT_PRIVACY)).toEqual(['orgs', 'repos', 'commits', 'titles', 'emails']);
  });

  it('blurs nothing while the master switch is off, whatever the kinds say', () => {
    expect(blurredKinds({ ...DEFAULT_PRIVACY, on: false })).toEqual([]);
  });

  it('leaves out the kinds switched off', () => {
    expect(blurredKinds({ on: true, blur: { ...DEFAULT_PRIVACY.blur, commits: false, emails: false } })).toEqual(['orgs', 'repos', 'titles']);
  });

  it('blurs a kind that a setting saved before it existed does not list', () => {
    const saved = { on: true, blur: { orgs: false } } as unknown as Privacy;
    expect(blurredKinds(saved)).toEqual(['repos', 'commits', 'titles', 'emails']);
  });
});
