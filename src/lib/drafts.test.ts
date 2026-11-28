import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser, storage } from '#imports';
import { useDraft } from './drafts';
import { saveToken } from './persist';
import { accountItem } from './settings';

let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  root = createRoot(document.createElement('div'));
  vi.spyOn(browser.storage.local, 'getKeys').mockImplementation(async () => Object.keys(await browser.storage.local.get(null)));
  await accountItem.setValue('a');
});

afterEach(async () => {
  await act(() => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function editor(key: string) {
  let draft: ReturnType<typeof useDraft>;
  function Editor() {
    draft = useDraft(key);
    return draft[0];
  }
  return {
    element: createElement(Editor),
    get text() { return draft[0]; },
    edit: (text: string) => act(() => draft[1](text)),
    clear: () => act(() => draft[2]()),
  };
}

it('keeps the latest review summary when switching editors before storage has saved it', async () => {
  const conversation = editor('review');
  const files = editor('review');
  await act(() => root.render(conversation.element));
  await conversation.edit('Review summary');
  await act(() => root.render(files.element));
  expect(files.text).toBe('Review summary');
  await act(() => root.render(createElement('div', null, conversation.element, files.element)));
  await files.edit('Updated summary');
  expect(conversation.text).toBe('Updated summary');

  await conversation.clear();
  expect(files.text).toBe('');
  await vi.runAllTimersAsync();
  await act(() => root.render(null));
  await act(() => root.render(files.element));
  expect(files.text).toBe('');
});

it('restores saved Drafts, including a Draft from before Accounts had separate Draft keys', async () => {
  await storage.setItem('local:draft:restore', 'Saved before update');
  const row = editor('restore');
  await act(() => root.render(row.element));
  expect(row.text).toBe('Saved before update');
  await row.edit('Saved after update');
  await act(() => root.render(null));
  await vi.runAllTimersAsync();
  await act(() => root.render(row.element));
  expect(row.text).toBe('Saved after update');
  await row.clear();
  await act(() => root.render(null));
  await act(() => root.render(row.element));
  expect(row.text).toBe('');
});

it('keeps a delayed write from the previous Account out of the next Account', async () => {
  const row = editor('same-issue');
  await act(() => root.render(row.element));
  await row.edit('Private Draft');
  await act(() => saveToken('next'));
  expect(row.text).toBe('');
  await row.edit('Different Draft');
  await vi.runAllTimersAsync();
  await act(() => root.render(null));
  await act(() => root.render(row.element));
  expect(row.text).toBe('Different Draft');
  expect(await storage.getItem('local:account-draft:a:same-issue')).toBeNull();
});

it('keeps a Draft cleared while its first read is still in flight', async () => {
  await storage.setItem('local:draft:late', 'Previous text');
  const saved = await storage.getItems(['local:account-draft:a:late', 'local:draft:late']);
  const read = Promise.withResolvers<typeof saved>();
  vi.spyOn(storage, 'getItems').mockReturnValueOnce(read.promise);
  const row = editor('late');
  await act(() => root.render(row.element));
  await row.clear();
  await act(async () => { read.resolve(saved); });
  expect(row.text).toBe('');
});
