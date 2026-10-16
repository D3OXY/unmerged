import { beforeEach, describe, expect, it } from 'vitest';
import { cachedQuery, setPageAccount } from './localCache';

beforeEach(() => localStorage.clear());

describe('cachedQuery', () => {
  it("is dropped when the page's account changes", async () => {
    setPageAccount('a');
    const viewer = cachedQuery<string>('test:viewer');
    await viewer.save(Promise.resolve('octocat'));
    expect(viewer.initialData()).toBe('octocat');

    setPageAccount('b');
    expect(viewer.initialData()).toBeUndefined();
    expect(localStorage.getItem('test:viewer')).toBeNull();
  });

  it('files a result under the account its fetch started with', async () => {
    setPageAccount('a');
    const viewer = cachedQuery<string>('test:viewer');
    const { promise, resolve } = Promise.withResolvers<string>();
    const saving = viewer.save(promise);
    setPageAccount('b');
    resolve('octocat');
    await saving;
    expect(viewer.initialData()).toBeUndefined();
  });
});
