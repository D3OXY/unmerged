# Store listings

What to paste into the Chrome Web Store and Firefox Add-ons (AMO) forms. Keep it in step with the extension
and with the privacy policy at https://unmerged.deoxy.dev/privacy (`site/src/routes/privacy.tsx`).

## Packages

- Chrome: `pnpm zip` → `.output/unmerged-<version>-chrome.zip`.
- Firefox: `pnpm zip:firefox` → `.output/unmerged-<version>-firefox.zip`, plus `unmerged-<version>-sources.zip`
  for AMO's source code upload (the bundle is minified). WXT builds Firefox as Manifest V2.
- The Firefox id is `unmerged@deoxy.dev` (`wxt.config.ts`). It can't change once the add-on is on AMO.

## Shared listing copy

**Name:** Unmerged

**Summary** (Chrome allows 132 characters, AMO 250):

> GitHub, as if it never got acquired. A calmer, faster skin for github.com: same URLs, same session.

**Description:**

> Unmerged re-skins github.com in place. You keep your URLs, your GitHub session and your bookmarks, and pages
> look calmer and load faster.
>
> It takes over home, profiles, organizations, repositories, files, branches, pull requests (conversation,
> commits, checks, files), commits, comparisons and new pull requests, workflow runs, issues, your pull
> request and issue lists, notifications and search. Every other page is GitHub's own. You can switch each
> page off, and Classic shows GitHub's page for the current URL whenever you want it.
>
> - Pages swap in place and their data starts loading when you hover a link.
> - Results are cached on your device, so a page you've seen draws at once.
> - ⌘K palette, j/k to move through lists, keyboard shortcuts on every page.
> - Light and dark themes, seven presets, or your own from two colors.
>
> Unmerged needs a GitHub personal access token, which you paste into the extension's settings. It is stored
> in the extension and only ever sent to api.github.com. There is no server and no analytics.
>
> Not affiliated with GitHub. Source code: https://github.com/D3OXY/unmerged

**Homepage:** https://unmerged.deoxy.dev · **Support:** https://unmerged.deoxy.dev/support (hello@deoxy.dev) ·
**Privacy policy:** https://unmerged.deoxy.dev/privacy

## Chrome Web Store

- **Category:** Developer Tools. **Language:** English.
- **Images:** the 128×128 icon (`public/icon/128.png`), 1 to 5 screenshots at 1280×800, and a 440×280 small
  promo tile.
- **Single purpose:** Replaces the look of github.com pages with a faster, simpler interface built on GitHub's
  API.
- **Permission justifications:**
  - `storage`: keeps the user's GitHub token, settings and cached GitHub results on the device.
  - `unlimitedStorage`: the cache of GitHub results can grow past the default 10 MB; it is capped at 50 MB.
  - Host permission `api.github.com`: loads the data the pages show, with the user's token.
  - Content script on `github.com`: draws the extension's pages in place of GitHub's.
- **Remote code:** No. Everything that runs, including the diff renderer and syntax grammars, is in the
  package.
- **Data usage:** tick Authentication information (the token, sent only to api.github.com) and certify the
  three statements (not sold, not used for unrelated purposes, not used for credit decisions).
- **Test instructions:** reviewers need a token. Give them a fine-grained, read-only token for a throwaway
  account, with the steps "click the toolbar icon, paste the token, open github.com/<that account>".

## Firefox Add-ons (AMO)

- **Categories:** Appearance, Web Development.
- **License:** MIT License (`LICENSE`).
- **Data collection:** the manifest declares none (`data_collection_permissions: { required: ['none'] }`):
  data only goes to GitHub, the site the extension is for.
- **Source code:** upload the sources zip. **Notes to reviewer:**

  > Built with WXT. Node 24 and pnpm 12: `pnpm install --frozen-lockfile && pnpm build:firefox`; the output is
  > `.output/firefox-mv2`. The extension needs a GitHub token: click the toolbar icon, paste the token below,
  > then open github.com. Token: <fine-grained read-only token for a test account>
