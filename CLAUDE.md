# Unmerged

WXT (MV3) extension that re-skins github.com in place: React 19 in a shadow root, TanStack Query, Tailwind v4,
TypeScript 7, pnpm. README.md explains the user-facing behaviour; this file covers what the code relies on.

## Commands

- `pnpm install` first: it runs `wxt prepare`, which generates `.wxt/tsconfig.json` (our tsconfig extends it).
- `pnpm check` before a PR: typecheck, tests, lint, Chrome build, site build. CI runs it plus `pnpm build:firefox`.
- `pnpm test` (Vitest with WXT's plugin and happy-dom; tests sit next to the code as `*.test.ts`), `pnpm lint`
  (ESLint: Hooks rules and typescript-eslint's recommended set; no formatter), `pnpm typecheck`.
- `typescript` in package.json is an alias for the TypeScript 6 API package, which typescript-eslint needs;
  `tsc` itself is TypeScript 7 (`@typescript/native`). Don't "fix" the alias.

## Website (`site/`)

- unmerged.deoxy.dev: a TanStack Start app, its own package in the pnpm workspace (`pnpm site` for dev).
  Everything is prerendered; `site/dist/client` is the deployable output. Vercel deploys it from `main` only
  (`site/vercel.json` sets the output; preview deployments are off in the Vercel project).
- It reuses the extension's `src/ui/tokens.css`, fonts and logo by relative path, so changing those changes
  the site too. Its hero product shot copies the PR page's markup, and draws its diffs at build time
  (`site/prerenderDiffs.ts`) with the extension's renderer settings (`src/lib/diffLook.ts`): keep it in step
  with the UI. Its copy makes claims about the extension (pages, speed numbers, privacy): keep them true.
- The root tsconfig excludes `site/`; the site has its own tsconfig. ESLint covers both.

## Content-script lifecycle (`src/entrypoints/github.content/index.tsx`)

- Runs at `document_start`. For a URL we own it hides GitHub's `<body>` synchronously, then mounts the app in
  a shadow root on `<html>` so Turbo's body swaps can't remove it.
- Once `<head>` is parsed it calls `window.stop()`, so GitHub's body and scripts never load. That also cancels
  any request already in flight, ours included: start nothing before that point. Leaving an owned page for
  one of GitHub's after a stop must be a full reload (`sync` does this).
- Routing: `matchRoute` (`src/lib/routes.ts`) decides ownership; it must stay synchronous and never throw.
  Surfaces switched off in the popup and the Classic pill (`src/lib/classic.ts`) are applied in `resolve`.

## Route → prefetch → page

Adding or changing a page touches four places that must agree: the `Route` in `src/lib/routes.ts`, its
`Surface` in `src/lib/settings.ts`, the render in `src/app/App.tsx`, and its case in `prefetchRoute`
(`src/app/prefetch.ts`). Prefetch calls the page's own query-option functions with the same arguments the
page derives from the URL. If the query keys drift, nothing breaks visibly; navigations just get slower.

## Caching

- Queries opt in to the extension-storage cache, per query, with `persister: persisted` (`src/lib/persist.ts`):
  the stored result paints at once on the next visit while the request refreshes it. Entries are per account.
- Settings the first paint needs synchronously are mirrored in github.com's `localStorage` via `localCache`.

## Aliases in `wxt.config.ts`

`shiki`, `shiki/wasm` and `@pierre/theming/themes` are swapped for slim local modules (`src/lib/shikiLite.ts`
and friends) so `@pierre/diffs` doesn't inline every grammar and theme. Grammars are copied to `shiki-langs/`
at build time and loaded on first use. The renderer is its own entrypoint (`src/entrypoints/diffs.ts`) loaded
on demand by `src/lib/diffs.ts`.

## Security rules

- The token lives in extension storage (`tokenItem`) and is only sent to api.github.com, by
  `src/github/client.ts`. Never put it in the page DOM, a URL, or github.com's `localStorage`.
- Don't put new API data in github.com's `localStorage`: GitHub's scripts and other extensions can read it.
  Use `persisted` instead.
- Only GitHub-sanitized HTML or escaped Shiki output goes into `dangerouslySetInnerHTML`.
- github.com's CSP blocks media from other hosts, so linked videos play in the extension's own page
  (`src/entrypoints/player`, framed from `src/lib/player.ts`). It loads nothing until played; keep it that way.

## Code style

No `any`; prefer inferred types; no barrel `index.ts` files; short doc comments above functions, not
line-by-line comments; keep comments in sync with the code.
