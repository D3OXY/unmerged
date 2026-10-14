import { pinsItem, useStorageItem } from './settings';

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const isPinned = (pins: string[] | null, repo: string) => !!pins?.some((p) => same(p, repo));

/** Live: whether `repo` is pinned. */
export const useIsPinned = (repo: string) => isPinned(useStorageItem(pinsItem), repo);

/**
 * Pins `repo`, or moves it if already pinned. It lands just before `before`, or at the end when
 * `before` is missing or not pinned.
 */
export async function pin(repo: string, before?: string) {
  const rest = (await pinsItem.getValue()).filter((p) => !same(p, repo));
  const at = before ? rest.findIndex((p) => same(p, before)) : -1;
  rest.splice(at === -1 ? rest.length : at, 0, repo);
  await pinsItem.setValue(rest);
}

export async function unpin(repo: string) {
  await pinsItem.setValue((await pinsItem.getValue()).filter((p) => !same(p, repo)));
}
