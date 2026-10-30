/** A commit as the Files changed commit picker lists it. */
export type PickerCommit = { oid: string; abbreviatedOid: string; messageHeadline: string; committedDate: string; parents: { nodes: { oid: string }[] } };

/** The commit a range (`PrRoute.range`) shows the files at: the one commit, or the one after "..". */
export const rangeHead = (range: string) => range.split('..')[1] ?? range;

/**
 * The range that shows `commits[from]` to `commits[to]` (oldest first, either order): one commit's own changes,
 * or the changes since the commit before the first. Null when that commit isn't known (a root commit).
 */
export function rangeFor(commits: PickerCommit[], from: number, to: number) {
  const first = Math.min(from, to);
  const last = Math.max(from, to);
  if (first === last) return commits[first]!.oid;
  const before = commits[first - 1]?.oid ?? commits[first]!.parents.nodes[0]?.oid;
  return before ? `${before}..${commits[last]!.oid}` : null;
}

/** Which of `commits` (oldest first) a range shows, as indexes. Empty when its commits aren't among them. */
export function commitsIn(commits: PickerCommit[], range: string) {
  const find = (sha: string) => commits.findIndex((c) => c.oid.startsWith(sha.toLowerCase()));
  const [base, head] = range.split('..') as [string, string | undefined];
  if (!head) {
    const i = find(base);
    return i === -1 ? [] : [i];
  }
  const last = find(head);
  // Starts after `base`, or at the commit on top of it when `base` isn't listed (the pull request's base).
  const start = find(base) !== -1 ? find(base) + 1 : commits.findIndex((c) => c.parents.nodes[0]?.oid.startsWith(base.toLowerCase()));
  if (last === -1 || start === -1 || start > last) return [];
  return Array.from({ length: last - start + 1 }, (_, i) => start + i);
}
