import { useSyncExternalStore } from 'react';
import { storage } from '#imports';
import { accountItem } from './settings';
import { createStore } from './store';

type Draft = {
  ready: Promise<void>;
  get(): string;
  set(text: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
  stop(): void;
};

type Drafts = {
  account?: Promise<string>;
  entries: Map<string, Draft>;
};
const current = createStore<Drafts>({ entries: new Map() });
accountItem.watch((account) => {
  const previous = current.get();
  current.set({ account: Promise.resolve(account), entries: new Map() });
  for (const draft of previous.entries.values()) draft.stop();
});

/** A shared Draft for a pull request, issue, thread or line. Clear it once the comment is sent. */
export function useDraft(key: string) {
  const drafts = current.use();
  const draft = drafts.entries.get(key) ?? openDraft(drafts, key);
  const text = useSyncExternalStore(draft.subscribe, draft.get);
  // A send can finish after its editor closes. Clear the submitted text, even if another editor
  // has since opened the Draft. A later edit belongs to the next comment.
  const clear = async () => {
    if (current.get() !== drafts) return;
    const latest = drafts.entries.get(key) ?? openDraft(drafts, key);
    if (latest !== draft) await latest.ready;
    if (latest.get() === text) latest.clear();
  };
  return [text, draft.set, clear] as const;
}

function openDraft(drafts: Drafts, key: string) {
  const listeners = new Set<() => void>();
  const owner = drafts.account ??= accountItem.getValue();
  const legacy = `local:draft:${key}` as const;
  let text: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<void> | undefined;

  const notify = () => listeners.forEach((listener) => listener());
  const forget = () => {
    if (!listeners.size && !timer && !saving && drafts.entries.get(key) === draft) drafts.entries.delete(key);
  };

  const save = () => {
    clearTimeout(timer);
    timer = undefined;
    const value = text;
    // A clear can follow a save that is still in flight.
    const write = Promise.all([owner, saving]).then(async ([account]) => {
      if (current.get() !== drafts) return;
      const id = `local:account-draft:${account}:${key}` as const;
      if (value) await storage.setItem(id, value);
      else await storage.removeItems([id, legacy]);
      if (await accountItem.getValue() !== account) await storage.removeItem(id);
    });
    // A closed tab or invalid extension context can reject a write. The next edit can still save.
    const done = write.catch(() => {});
    saving = done;
    void done.then(() => {
      if (saving === done) saving = undefined;
      forget();
    });
  };

  const ready = owner.then(async (account) => {
    const [saved, old] = await storage.getItems([`local:account-draft:${account}:${key}`, legacy]);
    // A late read must also respect an edit that emptied the Draft.
    if (text === undefined) {
      const value: unknown = saved!.value ?? old!.value;
      text = typeof value === 'string' ? value : '';
      notify();
    }
  }).catch(() => {});

  const draft = {
    ready,
    get: () => text ?? '',
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        queueMicrotask(forget);
      };
    },
    set(next: string) {
      text = next;
      notify();
      clearTimeout(timer);
      timer = setTimeout(save, 500);
    },
    clear() {
      text = '';
      notify();
      save();
    },
    stop() {
      clearTimeout(timer);
    },
  };
  drafts.entries.set(key, draft);
  return draft;
}
