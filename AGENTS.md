# Unmerged

WXT (MV3) extension that re-skins github.com in place: React 19 in a shadow root. Performance and UX are the first priority.

> [!NOTE]
> Unmerged is in a very early stage. Breaking changes are expected and accepted; backward compatibility is not required. During automated tests, do not change real GitHub data outside the `D3OXY/unmerged` repo.

## What makes Unmerged special?

Unmerged is fast first, and it stays out of the user's way. Each change must keep these principles:

- **Performance**: Pages open fast and stay responsive. Unmerged must not make the browser slower.
- **No friction**: A GitHub user can use Unmerged without help. Familiar things stay where the user expects them.
- **Privacy**: Unmerged collects no data. It sends data only to GitHub.
- **Accessibility**: All users can use Unmerged, also with only a keyboard or with a screen reader.
- **Open source**: All code is public. Anyone can read it, report a problem, or contribute.

## Performance without compromise

Unmerged treats performance as a product feature. Watch for regressions caused by excessive data transfer, expensive CSS animations, inefficient list rendering, and similar problems. Consider performance in every change.

## Versioning (Changeset)

- Unmerged has one root product version. All versioned packages and apps use that version.
- While Unmerged is in alpha, never perform major or minor version bumps. Use a patch bump, including for breaking changes.
- Add a changeset only when a user could notice the change: new behavior, changed behavior, or a bug they could have hit.
- Do not add a changeset for maintenance: dependency updates, CI or build fixes, refactors, tests, tooling, or type-only changes. Shipping in a release does not make a change user-visible.
- Write each entry in plain language from the user's point of view. Do not include internal details such as ticket identifiers, service names, file paths, or infrastructure.
- Format each entry as `[Kind][Area] User-visible summary.` Kind is `New`, `Improved`, or `Fixed`. Area names the affected Surface (see CONTEXT.md).
- If an entry is only generic filler, such as "improve stability," "various fixes," or "latest compatible updates," skip the changeset.

## A note from DEOXY

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and YAGNI. Fight scope creep. Honor the maintainer's intent with solutions that are both minimal and realistic.

## A small glossary

We need to be on the same page with terminology. When communicating, use this language:

- **you** means the agent reading this file and changing Unmerged.
- **I, we, us, and maintainers** mean Ishan (AKA Deoxy) and anyone else building Unmerged.
- **user** means the person using Unmerged.
- more in `./CONTEXT.md`

## Traps

These break without a clear error.

- **The root `tsconfig.json` extends `.wxt/tsconfig.json`, which `wxt prepare` generates and git ignores.** In a new clone or worktree, run `pnpm install` first (its `postinstall` runs `wxt prepare`), or typecheck fails.
- **Load the code renderer only through `loadDiffs()` (`src/lib/diffs.ts`).** It loads `src/entrypoints/diffs.ts`, which holds `@pierre/diffs` and Shiki, as a separate script on demand. A static import of either one outside that entrypoint puts the full renderer in every page's bundle. Type-only imports are fine.
- **`window.stop()` cancels requests in flight, ours included.** On an owned page, the content script stops GitHub's page once its `<head>` is parsed. Start no request before that point. To leave an owned page for one of GitHub's pages after the stop, do a full reload.
- **A page lives in four places that must agree:** its `Route` in `src/lib/routes.ts`, its `Surface` in `src/lib/settings.ts`, its render in `src/app/App.tsx`, and its case in `prefetchRoute` (`src/app/prefetch.ts`). Prefetch calls the page's own query-option functions with the arguments that the page reads from the URL. If the query keys drift, nothing fails; navigations only get slower.

## Security

- The token lives in extension storage and goes only to api.github.com. Never put it in the page DOM, a URL, or github.com's `localStorage`.
- Never put API data in github.com's `localStorage`: GitHub's scripts and other extensions can read it. Cache it with the `persisted` query persister.
- Only GitHub-sanitized HTML or escaped Shiki output goes into `dangerouslySetInnerHTML`.
- github.com's CSP blocks media from other hosts, so linked videos play in the extension's own player page. The player loads nothing until the user plays it; keep it that way.

## Verifying

- Use the smallest proof that a change works: `pnpm exec eslint <files>` for changed files, `pnpm typecheck` for the extension or `pnpm --filter site typecheck` for the site, and `pnpm exec vitest run <files>` for focused tests. There is no formatter.
- **Do not run repo-wide checks** such as `pnpm check`, `pnpm test`, `pnpm lint`, or `pnpm build` unless asked. CI owns the full suite.
- Logic changes (routes, prefetch, caching, themes, data shaping) require focused tests for that behavior. Tests sit next to the code as `*.test.ts`.
- Async tests must wait on promises or observable state, never fixed sleeps or polling delays.
- Give user-visible site changes one integrated pass in the T3 preview browser without asking, once after integration (`pnpm site`, port 3000). For extension UI, `pnpm dev` opens a separate browser profile with the extension loaded; ask permission before computer use to drive it. Do not start a dev server if one is already running.
- In a pull request for a user-visible UI change, attach before and after screenshots or a recording that shows how it works. When the change only adds UI, a screenshot of the new UI is enough.

## Taste

- Always talk in ASD-STE100 Simplified Technical English. Always read CONTEXT.md, and use its ubiquitous language.
- Keep complexity at system boundaries. Business logic stays pure and testable; UI components stay focused on rendering and interaction.
- Prefer inferred types over redundant annotations. Avoid `any`.
- Comments explain purpose, usage, or non-obvious constraints—not each line of behavior. Keep them beside the code they describe.
- Users notice dropped frames, dishonest loading states, and stale labels. Avoid continuously repainting animations that waste GPU resources, especially on high-refresh displays.
- If a rule here conflicts with the task, explain the conflict clearly and get maintainer approval before breaking it.
