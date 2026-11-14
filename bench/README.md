# Benchmark

Unmerged against GitHub's own pages, loaded the same way in the same browser. `run.ts` is the whole benchmark;
`results/latest.json` holds the last results, and the Speed section on unmerged.deoxy.dev shows them.

## Run it

```sh
pnpm install
pnpm exec playwright install chromium
pnpm build:chrome
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

Every page is public, in `TanStack/query`, from a small pull request to one with 2,416 changed files, plus
Bun's rewrite in Rust (`oven-sh/bun#30412`: 2,188 files, a million lines, 707 comments) (see `SCENARIOS` in
`run.ts`). There are two kinds of scenario:

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
| Repository | First visit | 1.87 s | 1.19 s | 4.9 MB | 129 KB | 363 | 24 | 0 ms | 0 ms |
| Repository | Repeat visit | 1.15 s | 579 ms | 177 KB | 49 KB | 18 | 20 | 36 ms | 0 ms |
| Pull request | First visit | 2.20 s | 752 ms | 4.9 MB | 176 KB | 400 | 16 | 0 ms | 0 ms |
| Pull request | Repeat visit | 1.65 s | 620 ms | 751 KB | 109 KB | 45 | 10 | 0 ms | 0 ms |
| Long issue | First visit | 3.63 s | 1.01 s | 5.9 MB | 307 KB | 406 | 65 | 0 ms | 0 ms |
| Long issue | Repeat visit | 2.23 s | 641 ms | 179 KB | 164 KB | 17 | 7 | 34 ms | 0 ms |
| Files changed, 133 files | First visit | 2.78 s | 1.53 s | 5.9 MB | 266 KB | 396 | 17 | 0 ms | 0 ms |
| Files changed, 133 files | Repeat visit | 2.39 s | 1.46 s | 334 KB | 201 KB | 18 | 16 | 55 ms | 0 ms |
| Files changed, 2,416 files | First visit | 10.34 s | 1.98 s | 6.0 MB | 2.5 MB | 413 | 50 | 760 ms | 0 ms |
| Files changed, 2,416 files | Repeat visit | 10.49 s | 2.00 s | 304 KB | 2.5 MB | 15 | 84 | 638 ms | 0 ms |
| Very long pull request | First visit | 8.31 s | 910 ms | 5.9 MB | 943 KB | 436 | 23 | 0 ms | 0 ms |
| Very long pull request | Repeat visit | 7.77 s | 715 ms | 188 KB | 874 KB | 19 | 8 | 0 ms | 0 ms |
| Files changed, 2,188 files | First visit | > 60 s | 3.73 s | 7.3 MB | 5.7 MB | 428 | 51 | 10531 ms | 0 ms |
| Files changed, 2,188 files | Repeat visit | > 60 s | 2.54 s | 1.6 MB | 5.7 MB | 31 | 72 | 10519 ms | 0 ms |
| Repository → Pull requests | First visit | 1.26 s | 782 ms | 1.6 MB | 205 KB | 91 | 53 | 5 ms | 0 ms |
| Repository → Pull requests | Repeat visit | 1.11 s | 90 ms | 80 KB | 87 KB | 7 | 12 | 2 ms | 0 ms |
| Pull requests → a PR | First visit | 1.34 s | 653 ms | 482 KB | 205 KB | 92 | 30 | 302 ms | 0 ms |
| Pull requests → a PR | Repeat visit | 1.27 s | 119 ms | 197 KB | 151 KB | 22 | 14 | 307 ms | 17 ms |
| Pull request → Files changed | First visit | 1.18 s | 120 ms | 148 KB | 51 KB | 20 | 5 | 94 ms | 0 ms |
| Pull request → Files changed | Repeat visit | 1.18 s | 122 ms | 77 KB | 0 KB | 11 | 0 | 90 ms | 0 ms |
<!-- /results -->
