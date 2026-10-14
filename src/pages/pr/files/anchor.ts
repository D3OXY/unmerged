/** GitHub's anchor for a file in the diff view: `diff-<sha256(path)>`. We use the same ids so links interoperate. */
export async function diffAnchor(path: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path));
  return `diff-${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
