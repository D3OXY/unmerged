import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import * as github from '@/github/client';
import { quoteOf, useReview } from './Composer';

describe('quoteOf', () => {
  it('quotes every line, blank ones too, and leaves a blank line for the reply', () => {
    expect(quoteOf('First line\n\nSecond line\n')).toBe('> First line\n> \n> Second line\n\n');
  });
});

it.each(['', 'Another comment'])('clears only the submitted summary after switching editors, with the next Draft %j', async (next) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const reply = Promise.withResolvers<unknown>();
  vi.spyOn(github, 'gql').mockReturnValue(reply.promise);
  const root = createRoot(document.createElement('div'));
  const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
  const pr = { id: 'review-test', url: 'https://github.com/o/r/pull/1', viewerPendingReview: { nodes: [] } };
  let review: ReturnType<typeof useReview>;
  function Editor() {
    review = useReview(pr, ['pr', pr.id]);
    return review.body;
  }
  const show = (key: string | null) => act(() => root.render(createElement(QueryClientProvider, { client }, key && createElement(Editor, { key }))));
  try {
    await show('Conversation');
    await act(() => review.setBody('Sent summary'));
    const sent = review!.send('COMMENT');
    await show(null);
    await vi.runAllTimersAsync();
    await show('Files changed');
    expect(review!.body).toBe('Sent summary');
    if (next) await act(() => review.setBody(next));
    await act(async () => {
      reply.resolve({});
      await sent;
    });
    expect(review!.body).toBe(next);
    await act(() => review.clearBody());
  } finally {
    await act(() => root.unmount());
    client.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
