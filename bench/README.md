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
pnpm bench --only to-pulls,to-pr,to-files   # only the clicks inside a page
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
`SCENARIOS` in `run.ts`). There are two kinds of scenario:

- **Page loads** open a URL in a new tab, as when you follow a link from elsewhere or reload.
- **Clicks inside a page** (the rows with "→") are how most navigations happen: on a page that has loaded and
  settled for two seconds, the pointer rests on a link for 150 ms, as a user's does, then clicks. Unmerged
  starts loading on hover; both sides swap the page in place, without a full load. The links: a repository's
  Pull requests tab, a PR in a list of PRs merged on one day, and a PR's Files changed tab.

What each one measures:

- **Time:** from the start of the navigation (or from the click) until a known piece of the page's content is
  visible: a sentence from the README, the PR description, the newest comment, a line from the first diff, or
  the newest open PR's title, which the script reads from the API when that scenario starts. Text inside
  `<script>` and `<template>` doesn't count, so data that GitHub embeds before it renders doesn't count either.
- **Data and requests:** what crossed the network for the page, compressed, from the navigation (or from the
  hover) until two seconds after the content showed.
- **Blocking:** the part of each main-thread task past 50 ms, added up (as in Total Blocking Time), from the
  navigation (or the hover) until the content showed. That is how long the page couldn't respond to input.
- **First and repeat visits:** each run uses a new browser profile. The first visit starts with empty caches;
  the second loads the same page again, with the browser's cache and Unmerged's own cache filled. For a click,
  each visit loads the start page in a new tab and clicks the same link.

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
| Repository | First visit | 1.46 s | 1.28 s | 4.9 MB | 222 KB | 368 | 58 | 0 ms | 0 ms |
| Repository | Repeat visit | 1.20 s | 1.06 s | 178 KB | 70 KB | 20 | 19 | 33 ms | 0 ms |
| Pull request | First visit | 1.83 s | 1.68 s | 6.0 MB | 177 KB | 468 | 37 | 0 ms | 0 ms |
| Pull request | Repeat visit | 1.58 s | 1.51 s | 238 KB | 138 KB | 23 | 9 | 0 ms | 0 ms |
| Long issue | First visit | 2.86 s | 2.31 s | 5.9 MB | 263 KB | 433 | 64 | 0 ms | 0 ms |
| Long issue | Repeat visit | 2.58 s | 2.37 s | 168 KB | 164 KB | 17 | 6 | 33 ms | 0 ms |
| Files changed, 133 files | First visit | 2.57 s | 2.43 s | 6.0 MB | 398 KB | 415 | 34 | 10 ms | 0 ms |
| Files changed, 133 files | Repeat visit | 2.34 s | 2.20 s | 310 KB | 250 KB | 19 | 18 | 56 ms | 0 ms |
| Files changed, 2,416 files | First visit | 10.29 s | 9.56 s | 6.0 MB | 3.4 MB | 416 | 80 | 745 ms | 0 ms |
| Files changed, 2,416 files | Repeat visit | 10.03 s | 9.20 s | 305 KB | 1.7 MB | 18 | 65 | 650 ms | 0 ms |
| Repository → Pull requests | First visit | 1.67 s | 952 ms | 1.6 MB | 190 KB | 102 | 49 | 2 ms | 0 ms |
| Repository → Pull requests | Repeat visit | 1.31 s | 83 ms | 82 KB | 72 KB | 11 | 11 | 4 ms | 0 ms |
| Pull requests → a PR | First visit | 1.38 s | 723 ms | 461 KB | 221 KB | 91 | 30 | 267 ms | 0 ms |
| Pull requests → a PR | Repeat visit | 1.25 s | 109 ms | 197 KB | 147 KB | 22 | 13 | 300 ms | 12 ms |
| Pull request → Files changed | First visit | 1.21 s | 118 ms | 136 KB | 54 KB | 18 | 6 | 79 ms | 0 ms |
| Pull request → Files changed | Repeat visit | 1.25 s | 122 ms | 84 KB | 0 KB | 11 | 0 | 84 ms | 0 ms |
<!-- /results -->
