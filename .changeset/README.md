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

Merging it publishes the release: once Check passes on that commit, the Release workflow uploads the new
version to the Chrome Web Store and submits it for review (it goes live when Google approves it), then tags
it `v<version>` and creates a GitHub Release with its `CHANGELOG.md` section and the zip. A version without
its tag is one the store doesn't have yet. If the upload fails, run the Release workflow by hand with
`dry_run` off to retry; with `dry_run` on, it only checks the store sign-in. The store credentials are
secrets of the `chrome-web-store` environment, which only `main` can use.
