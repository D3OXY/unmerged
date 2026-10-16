<p align="center">
  <img src="src/assets/logo/holdout.svg" width="112" alt="Holdout, the Unmerged mascot">
</p>

<h1 align="center">Unmerged</h1>

<p align="center">
  GitHub, as if it never got acquired. A browser extension that re-skins github.com in place: same URLs,
  same session, a calmer Linear/Vercel/Raycast-style UI.
</p>

## What it takes over

| Page | URL | Fallback |
|---|---|---|
| Home | `github.com/` (signed in) | Logged-out marketing page is left alone |
| Profile | `github.com/<user>`, `?tab=repositories`, `?tab=achievements`, `?tab=followers`, `?tab=following` | Organizations, Stars and other `?tab=` views stay on GitHub |
| Pull request | `github.com/<owner>/<repo>/pull/<n>` plus `/commits`, `/checks`, `/files` | Single-commit views stay on GitHub |
| Repository | `github.com/<owner>/<repo>`, `/tree/…`, `/blob/…` | Issues, Actions, Settings, etc. stay on GitHub |
| Pull requests & issues | `github.com/pulls`, `/pulls/assigned`, `/issues`, … (any `?q=` search) | |
| Notifications | `github.com/notifications` (inbox, unread, participating) | |

Every other page is untouched. Each page can be switched off from the toolbar popup, and **Classic** (sidebar
or ⌘K) shows the stock page for the current URL with a pill to come back.

The theme follows GitHub's appearance setting by default; pick Light or Dark from the popup, the sidebar, or ⌘K.

## Install (dev)

```sh
pnpm install
pnpm build            # → .output/chrome-mv3
```

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `.output/chrome-mv3`.
Open github.com and paste a token when asked
([create one](https://github.com/settings/tokens/new?description=Unmerged&scopes=repo,read:org,read:user,user:follow,notifications)).

`pnpm dev` runs WXT with hot reload in a separate browser profile. `pnpm build:firefox` builds for Firefox.

## How it works

- A `document_start` content script hides GitHub's `<body>` for owned URLs before first paint and mounts a
  React app in a shadow root on `<html>` (so Turbo's body swaps can't remove it).
- Data comes from GitHub's GraphQL API with your token (stored in `chrome.storage.local` only).
- Links between owned pages swap in place (`pushState`), and so do GitHub links that point at them.
  Everything else is a normal page load. Back/forward onto owned pages is claimed before GitHub's router
  sees it.
- Keys aimed at GitHub's hidden page are swallowed so its hotkeys don't fire.
- Diffs are drawn by [`@pierre/diffs`](https://diffs.com) with Shiki. It lives in a separate script that pull
  request pages load in the background, and each language's grammar loads on first use, so every other page
  pays nothing for it.

## Shortcuts

`⌘K` palette (commands, repo/people search, `owner/repo#123` jumps) · `j`/`k` move between rows ·
`g h` home · `g p` your profile · `t` go to file (repo pages) · `⌘↵` send comment
