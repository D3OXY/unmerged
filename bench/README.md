# Benchmark

Unmerged against GitHub's own pages, loaded the same way in the same browser. `run.ts` is the whole benchmark;
`results/latest.json` holds the last results, and the Speed section on unmerged.deoxy.dev shows them.

## Run it

```sh
pnpm install
pnpm exec playwright install chromium
pnpm build
pnpm bench                  # all pages, 5 runs each
pnpm bench --runs 3 --only pr,issue
```

Unmerged needs a GitHub token: set `GITHUB_TOKEN` (a fine-grained, read-only token is enough), or sign in with
the GitHub CLI and the script uses `gh auth token`. The token goes only to Unmerged's popup, as a user would
paste it. A run writes `results/latest.json` and the table below; `--no-write` only prints the numbers.

To measure another build, point `UNMERGED_EXTENSION` at its `.output/chrome-mv3` folder.

### Signed in

By default both sides load github.com signed out. To compare the way people use GitHub, sign in once:

```sh
pnpm bench:login   # opens a browser window: sign in to GitHub there
pnpm bench         # now loads both sides signed in
```

`bench:login` needs a desktop (it opens a visible window). It saves the session to `bench/.auth/github.json`,
which git ignores. That file is a full GitHub session: keep it private, and delete it or sign that session out
on GitHub (Settings → Sessions) when you're done.

## What it measures

Every page is public, in `TanStack/query`, from a small pull request to one with 2,416 changed files (see
`SCENARIOS` in `run.ts`).

- **Time:** from the start of the navigation until a known piece of the page's content is visible: a sentence
  from the README, the PR description, the newest comment, or a line from the first diff. Text inside
  `<script>` and `<template>` doesn't count, so data that GitHub embeds before it renders doesn't count either.
- **Data and requests:** what crossed the network for the page, compressed, from the navigation until two
  seconds after the content showed.
- **Blocking:** the part of each main-thread task past 50 ms, added up (as in Total Blocking Time), until the
  content showed. That is how long the page couldn't respond to input.
- **First and repeat visits:** each run uses a new browser profile. The first visit starts with empty caches;
  the second loads the same page again, with the browser's cache and Unmerged's own cache filled.

## How to read it

- Both sides load github.com signed out, unless a session from `pnpm bench:login` is present (the results say
  which). Unmerged also has its token.
- Headless Chromium, 1440×900, no CPU or network throttling, from wherever you run it. GitHub's servers and
  your connection move the numbers between runs, so compare a run's two columns rather than runs with each other.
- The medians come from 5 runs unless the table says otherwise. A time of "> 60 s" means the content didn't
  show within a minute in most runs.

## Latest results

<!-- results -->
Measured 2026-10-19, median of 1 runs. Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36

| Page | Visit | Time GitHub | Time Unmerged | Data GitHub | Data Unmerged | Requests GitHub | Requests Unmerged | Blocking GitHub | Blocking Unmerged |
|---|---|---|---|---|---|---|---|---|---|
| Repository | First visit | 891 ms | 1.50 s | 2.3 MB | 219 KB | 218 | 64 | 297 ms | 184 ms |
| Repository | Repeat visit | 446 ms | 398 ms | 36 KB | 38 KB | 12 | 20 | 43 ms | 134 ms |
| Pull request | First visit | 723 ms | 2.26 s | 5.0 MB | 197 KB | 385 | 40 | 7 ms | 160 ms |
| Pull request | Repeat visit | 575 ms | 368 ms | 255 KB | 98 KB | 13 | 4 | 9 ms | 97 ms |
| Long issue | First visit | 2.49 s | 4.13 s | 4.8 MB | 1.8 MB | 371 | 76 | 260 ms | 174 ms |
| Long issue | Repeat visit | 1.06 s | 557 ms | 97 KB | 120 KB | 14 | 3 | 259 ms | 143 ms |
| Files changed, 202 files | First visit | 1.48 s | 3.11 s | 1.7 MB | 314 KB | 168 | 37 | 0 ms | 611 ms |
| Files changed, 202 files | Repeat visit | 1.17 s | > 60 s | 251 KB | 192 KB | 12 | 13 | 349 ms | 485 ms |
| Files changed, 2,416 files | First visit | 1.96 s | 7.38 s | 1.7 MB | 2.4 MB | 167 | 89 | 0 ms | 909 ms |
| Files changed, 2,416 files | Repeat visit | 368 ms | 5.58 s | 242 KB | 652 KB | 6 | 58 | 0 ms | 1091 ms |
<!-- /results -->
