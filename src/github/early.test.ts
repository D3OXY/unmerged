import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

const URL_ = 'https://api.github.com/graphql';
const body = JSON.stringify({ query: 'query Pr { x }', variables: { number: 1 } });
const init = (token: string): RequestInit => ({ method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body });

// The background and the page each load their own copy of the module; here one copy plays both, and the fake
// browser carries the page's question to the background's answer.
let early: typeof import('./early');
const network = vi.fn(async () => new Response('{"data":1}', { headers: { 'x-ratelimit-remaining': '42' } }));

beforeEach(async () => {
  fakeBrowser.reset();
  vi.resetModules();
  network.mockClear();
  vi.stubGlobal('fetch', network);
  early = await import('./early');
  // As background.ts answers.
  fakeBrowser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const answer = early.answerEarly(message);
    if (!answer) return;
    answer.then(sendResponse);
    return true;
  });
});

describe('keyOf', () => {
  it('is the same for the same request with another token, and differs by body', () => {
    expect(early.keyOf(URL_, init('a'))).toBe(early.keyOf(URL_, init('b')));
    expect(early.keyOf(URL_, { ...init('a'), body: '{}' })).not.toBe(early.keyOf(URL_, init('a')));
  });
});

describe('apiFetch', () => {
  it("gives a page the background's answer, status and headers included, once", async () => {
    early.keepEarlyAnswers();
    // The background's own query reads the body; the kept answer still has it.
    expect(await (await early.apiFetch(URL_, init('a'))).json()).toEqual({ data: 1 });

    early.takeEarlyAnswers();
    const taken = await early.apiFetch(URL_, init('a'));
    expect(network).toHaveBeenCalledOnce();
    expect([taken.status, taken.headers.get('x-ratelimit-remaining'), await taken.json()]).toEqual([200, '42', { data: 1 }]);

    await early.apiFetch(URL_, init('a'));
    expect(network).toHaveBeenCalledTimes(2);
  });

  it('makes the request itself when the background has no answer for it', async () => {
    early.takeEarlyAnswers();
    expect(await (await early.apiFetch(URL_, init('a'))).json()).toEqual({ data: 1 });
    expect(network).toHaveBeenCalledOnce();
  });
});
