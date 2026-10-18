# Contributing to Unmerged

Unmerged is in alpha. Things change fast, and breaking changes are acceptable.

## Report a problem

Open an issue. Give the github.com URL, what you expected and what you saw. A screenshot helps. Do not paste
your token or data from private repositories.

If a page looks wrong, open Classic (sidebar or ⌘K) and see if GitHub's own page has the same problem.

## Set up

You need Node 24 and pnpm 12, the same as CI.

```sh
pnpm install      # also runs `wxt prepare`; typecheck fails without it
pnpm dev          # Chrome with the extension, in a separate profile, with hot reload
pnpm dev:firefox  # the same in Firefox
pnpm site         # the website (site/), on port 3000
```

Click the Unmerged toolbar icon and paste a token. The [README](README.md#token) tells which scopes to give it.

## Before you change code

Read [CONTEXT.md](CONTEXT.md). It gives the words that we use in code, comments, UI copy and changesets.

Each change must keep these principles:

- **Performance**: Pages open fast and stay responsive. Look for large data transfers, expensive CSS
  animations and slow list rendering.
- **No friction**: Familiar things stay where a GitHub user expects them.
- **Privacy**: Unmerged sends data only to GitHub, and the token only to `api.github.com`.
- **Accessibility**: Everything works with only a keyboard and with a screen reader.

Some mistakes break without a clear error. Read the Traps and Security sections of [AGENTS.md](AGENTS.md)
before you add a page, load the code renderer or touch the token.

For a large change, open an issue first, so that we agree on the approach before you write the code.

## Check your change

Run the checks for what you changed:

```sh
pnpm exec eslint <files>
pnpm typecheck                 # the extension
pnpm --filter site typecheck   # the site
pnpm exec vitest run <files>
```

`pnpm check` runs the full suite that CI runs. There is no formatter.

Logic changes (routes, prefetch, caching, themes, data shaping) need focused tests. Put them next to the code
as `*.test.ts`. Async tests wait on promises or observable state, never on fixed sleeps.

## Changesets

Add a changeset only when a user could notice the change: new behavior, changed behavior, or a bug they
could have hit. Run `pnpm changeset`, select `unmerged` and `patch`, and write one line as
`[Kind][Area] User-visible summary.` The [changeset README](.changeset/README.md) has the details.

Do not add one for dependency updates, CI, refactors, tests or docs.

## Pull requests

- Keep one change in each pull request.
- In the description, tell the problem, the new behavior and how you checked it.
- For a UI change, attach before and after screenshots or a recording. If the change only adds UI, a
  screenshot of the new UI is enough.
- CI runs `pnpm check` and the Firefox build. Both must pass.

## License

Your contributions are licensed under the [MIT License](LICENSE), the same as the project.
