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
version to the Chrome Web Store and Firefox Add-ons and submits it for review (it goes live when each store
approves it), then tags it `v<version>` and creates a GitHub Release with its `CHANGELOG.md` section and both
zips. A version without its tag is one the stores don't have yet. If an upload fails, open that run and click
**Re-run failed jobs**: it uploads to the failed store again, then tags. Run the Release workflow by hand with
`dry_run` on to check the store sign-ins only. Each store's credentials are secrets of its environment,
`chrome-web-store` or `firefox-add-ons`, which only `main` can use.
