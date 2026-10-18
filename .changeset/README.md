# Changesets

Add a changeset for each change a user could notice: new behaviour, changed behaviour, or a bug they could
have hit.

```sh
pnpm changeset
```

Select `unmerged` and `patch`, then write one line as `[Kind][Area] User-visible summary.`, for example
`[New][Pull requests] Resolve review threads from the conversation.` Kind is `New`, `Improved` or `Fixed`;
Area names the page or surface. Unmerged releases are patch-only, and `pnpm check` rejects anything else.

When Check passes on `main` with pending changesets, the Release workflow opens (or refreshes) a draft
`d3oxy/release` pull request that bumps the version in `package.json`, which the extension manifest uses,
and writes the dated release to `CHANGELOG.md`. Mark it ready for review so Check runs, then merge it.
