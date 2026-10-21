<p align="center">
  <img src="src/assets/logo/holdout.svg" width="112" alt="Holdout, the Unmerged mascot">
</p>

<h1 align="center">Unmerged</h1>

<p align="center">
  GitHub, as if it never got acquired. A browser extension that re-skins github.com in place: same URLs,
  same session, a calmer Linear/Vercel/Raycast-style UI.
</p>

<p align="center">
  <img src=".github/screenshot.png" alt="A repository page in Unmerged, split diagonally between dark and light mode">
</p>

## What it covers

Home, profiles, organizations, repositories (files, commits, branches, releases and tags, contributors), pull requests, commits,
compare and new pull request, Actions (workflow runs and job logs), issues, your pull request and issue lists,
notifications and search.
Every other page stays GitHub's own.

Switch any page off from the toolbar popup. **Classic** (sidebar or ⌘K) shows GitHub's page for the current URL,
with a pill to come back.

## Install

Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/dimbendmcjfgoldbcebkepgonkfopcab)
or [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/unmerged/), then click the Unmerged toolbar icon
and paste a token.

To run your own build instead, build it and load it unpacked:

```sh
pnpm install
pnpm build            # Chrome → .output/chrome-mv3
pnpm build:firefox    # Firefox → .output/firefox-mv2
```

In Chrome, open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick
`.output/chrome-mv3`. Then click the Unmerged toolbar icon and paste a token.

## Token

Unmerged keeps the token in extension storage and sends it only to `api.github.com`. You type it into the
extension's own page, never into github.com. Changing the token, or **Disconnect**, deletes everything cached
for the old one.

**Classic token** (simplest, everything works):
[create one](https://github.com/settings/tokens/new?description=Unmerged&scopes=repo,read:org,read:user,user:follow,notifications)
with `repo`, `read:org`, `read:user`, `user:follow` and `notifications`. `repo` gives write access to private
repos (classic tokens have no read-only scope for them). If you only read public code, use `public_repo`.

**Fine-grained token** (least privilege):
[create one](https://github.com/settings/personal-access-tokens/new) and give it only what you use:

| Feature | Permission |
|---|---|
| Read repos, pull requests, issues and lists (always needed) | Repository → Metadata, Contents, Pull requests, Issues: read |
| Checks, workflow runs and job logs | Repository → Checks, Commit statuses, Actions: read |
| Comment, review, open, close or edit pull requests | Repository → Pull requests: read and write |
| Merge, update or delete a branch | Repository → Contents and Pull requests: read and write |
| Re-run checks or jobs | Repository → Actions: read and write |
| Star, watch, follow | Account → Starring, Watching, Followers: read and write |

A fine-grained token covers one owner, so repos outside it don't show up. The Notifications page needs a
classic token: switch it off in the popup if you use a fine-grained one.

## Shortcuts

`⌘K` palette (commands, repos, people, `owner/repo#123`, or `#123` inside a repo) · `j`/`k` move between rows ·
`g h` home · `g p` your profile · `t` go to file · `⌘↵` send comment · `?` every shortcut on the current page

## Development

`pnpm dev` runs the extension with hot reload in a separate browser profile. `pnpm site` runs the website
([unmerged.deoxy.dev](https://unmerged.deoxy.dev), in `site/`) on port 3000. `pnpm check` runs what CI runs.

To contribute, read [CONTRIBUTING.md](CONTRIBUTING.md). Rules for AI agents are in
[AGENTS.md](AGENTS.md), and the project's terms are in [CONTEXT.md](CONTEXT.md).

## License

[MIT](LICENSE).
