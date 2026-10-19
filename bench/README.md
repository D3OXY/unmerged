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
Measured 2026-10-19, median of 5 runs, signed in to github.com. Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36

| Page | Visit | Time GitHub | Time Unmerged | Data GitHub | Data Unmerged | Requests GitHub | Requests Unmerged | Blocking GitHub | Blocking Unmerged |
|---|---|---|---|---|---|---|---|---|---|
| Repository | First visit | 1.46 s | 1.19 s | 4.9 MB | 274 KB | 373 | 61 | 0 ms | 0 ms |
| Repository | Repeat visit | 1.03 s | 1.04 s | 171 KB | 51 KB | 20 | 19 | 36 ms | 0 ms |
| Pull request | First visit | 1.89 s | 2.27 s | 6.1 MB | 206 KB | 472 | 37 | 0 ms | 0 ms |
| Pull request | Repeat visit | 1.64 s | 1.40 s | 233 KB | 104 KB | 24 | 7 | 0 ms | 0 ms |
| Long issue | First visit | 3.33 s | 2.37 s | 6.0 MB | 1.8 MB | 436 | 67 | 0 ms | 0 ms |
| Long issue | Repeat visit | 2.17 s | 2.19 s | 158 KB | 136 KB | 17 | 6 | 29 ms | 0 ms |
| Files changed, 133 files | First visit | 2.61 s | 2.39 s | 6.0 MB | 374 KB | 418 | 30 | 14 ms | 32 ms |
| Files changed, 133 files | Repeat visit | 2.38 s | 2.13 s | 313 KB | 246 KB | 20 | 15 | 53 ms | 31 ms |
| Files changed, 2,416 files | First visit | 11.49 s | 9.71 s | 6.0 MB | 3.3 MB | 418 | 76 | 731 ms | 0 ms |
| Files changed, 2,416 files | Repeat visit | 10.25 s | 8.77 s | 299 KB | 1.7 MB | 17 | 61 | 606 ms | 0 ms |
<!-- /results -->
