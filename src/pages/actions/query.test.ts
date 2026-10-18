import { describe, expect, it } from 'vitest';
import { parseRunQuery, setQualifier, workflowSegment } from './query';

describe('parseRunQuery', () => {
  it('maps GitHub’s qualifiers to the runs API’s parameters', () => {
    expect(parseRunQuery(' is:failure  branch:feature/x event:push actor:octocat ')).toEqual({
      filter: { status: 'failure', branch: 'feature/x', event: 'push', actor: 'octocat' },
      unknown: [],
    });
  });

  it('keeps words the API can’t filter by apart', () => {
    expect(parseRunQuery('workflow:CI flaky branch:main')).toEqual({ filter: { branch: 'main' }, unknown: ['workflow:CI', 'flaky'] });
  });
});

describe('setQualifier', () => {
  it('replaces the qualifier, under either name, and keeps the rest', () => {
    expect(setQualifier('status:queued branch:main', 'is', 'success')).toBe('branch:main is:success');
    expect(setQualifier('is:failure branch:main', 'branch', 'dev')).toBe('is:failure branch:dev');
  });

  it('removes it for an empty value', () => {
    expect(setQualifier('is:failure branch:main', 'is', '')).toBe('branch:main');
  });
});

describe('workflowSegment', () => {
  it('is the file name, or a dynamic workflow’s path after dynamic/', () => {
    expect(workflowSegment({ id: 1, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' })).toBe('ci.yml');
    expect(workflowSegment({ id: 2, name: 'pages-build-deployment', path: 'dynamic/pages/pages-build-deployment', state: 'active' })).toBe('pages/pages-build-deployment');
  });
});
