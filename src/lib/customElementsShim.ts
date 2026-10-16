// Content scripts run in an isolated world where `customElements` is null, and `@pierre/diffs` registers
// its <diffs-container> element when imported. Unmerged mounts diffs into plain elements instead (see
// prepareContainer in src/entrypoints/diffs.ts), so a registry that ignores definitions is enough.
// Import before `@pierre/diffs`.
if (!globalThis.customElements) {
  Object.defineProperty(globalThis, 'customElements', { value: { get: () => undefined, define: () => {} }, configurable: true });
}
