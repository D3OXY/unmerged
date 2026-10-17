/** See `prerenderDiffs.ts`. */
declare module 'virtual:product-diffs' {
  type Key = `${import('./pr').PatchPath}:${'unified' | 'split'}`;
  export const shared: string;
  export const diffs: Record<Key, string>;
}
