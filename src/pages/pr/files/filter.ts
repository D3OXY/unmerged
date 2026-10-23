import { useEffect, useState } from 'react';
import { fileFiltersItem, keepFileFiltersItem, useStorageItem } from '@/lib/settings';
import type { ViewedState } from '../query';
import type { PrFile } from './FileDiff';

/** A file's type as the filter groups it: its extension (".ts"), "dotfile" (".gitignore") or "none" ("Makefile"). */
export type FileType = `.${string}` | 'dotfile' | 'none';

/** What the Files tab's filter can hide: viewed files, deleted files, or a file type. */
export type Hidden = 'viewed' | 'deleted' | FileType;

/** The URL parameter that holds the filter: `?hide=viewed,.lock`. */
const PARAM = 'hide';

/**
 * The Files tab's filter: what it hides (null until read) and a setter. A `?hide=` in the URL always applies,
 * as a shared link should. Else the "Keep file filters" setting decides: 'all' starts from the last saved
 * filter, the others from nothing. Changes go to the URL only in 'url', and to storage only in 'all'.
 * In a side panel the URL is the list's, so the filter never reads or writes it there.
 */
export function useFileFilter(panel: boolean) {
  const keep = useStorageItem(keepFileFiltersItem);
  const [hidden, setHidden] = useState(() => (panel ? null : readUrl()));

  useEffect(() => {
    if (hidden !== null || keep === null) return;
    if (keep !== 'all') return setHidden([]);
    let current = true;
    fileFiltersItem.getValue().then((saved) => current && setHidden(parseHidden(saved)));
    return () => {
      current = false;
    };
  }, [hidden, keep]);

  const update = (next: Hidden[]) => {
    setHidden(next);
    if (keep === 'all') fileFiltersItem.setValue(next);
    if (!panel) writeUrl(keep === 'url' ? next : []);
  };
  return [hidden, update] as const;
}

export function fileType(path: string): FileType {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (name.startsWith('.')) return 'dotfile';
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? `.${name.slice(dot + 1).toLowerCase()}` : 'none';
}

/** The valid, distinct entries of an untrusted list (a URL parameter or saved storage). */
export function parseHidden(values: readonly string[]): Hidden[] {
  const valid = values.filter((v): v is Hidden => ['viewed', 'deleted', 'dotfile', 'none'].includes(v) || /^\.[^./]+$/.test(v));
  return [...new Set(valid)];
}

export function isShown(file: PrFile, hidden: ReadonlySet<Hidden>, viewState: ViewedState | undefined) {
  if (hidden.has(fileType(file.filename))) return false;
  if (hidden.has('viewed') && viewState === 'VIEWED') return false;
  return !(hidden.has('deleted') && file.status === 'removed');
}

/** Each file type in `files` with its file count, most files first. */
export function fileTypes(files: PrFile[]) {
  const counts = new Map<FileType, number>();
  for (const file of files) {
    const type = fileType(file.filename);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
}

function readUrl() {
  const value = new URL(location.href).searchParams.get(PARAM);
  return value === null ? null : parseHidden(value.split(','));
}

function writeUrl(hidden: Hidden[]) {
  const url = new URL(location.href);
  if (hidden.length) url.searchParams.set(PARAM, hidden.join(','));
  else url.searchParams.delete(PARAM);
  if (url.href !== location.href) history.replaceState(history.state, '', url);
}
