import { useEffect, useState } from 'react';
import { storage } from '#imports';

type DraftKey = `local:draft:${string}`;

/**
 * Unsent comment text, kept in extension storage under `key` (a PR, thread or diff line) so it survives
 * navigation and reloads. Returns `[text, setText, clear]`; call `clear` once the comment is sent.
 */
export function useDraft(key: string) {
  const id: DraftKey = `local:draft:${key}`;
  // Tagged with its key so another key's text never shows, even for the render where the key changes.
  const [draft, setDraft] = useState({ id, text: '' });
  const text = draft.id === id ? draft.text : '';

  useEffect(() => {
    let live = true;
    storage.getItem<string>(id).then((saved) => {
      // Typing that beat the read wins.
      if (live && saved) setDraft((d) => (d.id === id && d.text ? d : { id, text: saved }));
    });
    return () => {
      live = false;
    };
  }, [id]);

  const setText = (next: string) => {
    setDraft({ id, text: next });
    save(id, next);
  };
  const clear = () => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    setDraft({ id, text: '' });
    storage.removeItem(id);
  };
  return [text, setText, clear] as const;
}

// Pending debounced writes, per draft. They outlive the component, so leaving a page mid-word still saves.
const timers = new Map<DraftKey, ReturnType<typeof setTimeout>>();

function save(id: DraftKey, text: string) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      if (text) storage.setItem(id, text);
      else storage.removeItem(id);
    }, 500),
  );
}
