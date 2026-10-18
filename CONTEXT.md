# Unmerged

A browser extension that shows its own UI for some github.com pages, at the same URLs and with the same
session. This file is the project's ubiquitous language: use these words in code, comments, UI copy and
changesets.

## Pages

**Surface**:
A group of github.com pages that Unmerged can take over, such as Pull requests or Notifications. The user can
switch off each Surface in the toolbar popup.
_Avoid_: Area, section, workspace, feature

**Owned page**:
A github.com URL that Unmerged shows in place of GitHub's page. Every other URL stays GitHub's page.
_Avoid_: Supported page, handled page, our page

**Route**:
What Unmerged reads from an owned page's URL: which page it is and its arguments.
_Avoid_: Path, view

**Classic**:
GitHub's own page for the current URL, shown on request for one tab. A pill on that page brings the user
back to Unmerged.
_Avoid_: Stock view, original page, fallback

**Side panel**:
A pull request or issue that opens next to the list it came from, so the user keeps their place in the list.
_Avoid_: Peek (the code name), drawer, preview

**Pull request & issue lists**:
The cross-repository lists at `github.com/pulls` and `github.com/issues`.
_Avoid_: Work (the code name), dashboard, inbox

**Repo pulse**:
The strip on a repository's front page that shows its last 12 weeks of activity.
_Avoid_: Activity cards, stats, insights

**Draft**:
Comment text that the user has not sent yet. It stays after navigation and reload.
_Avoid_: Unsent comment, pending comment

**Pin**:
A repository that the user keeps in the sidebar's Pinned list.
_Avoid_: Favorite, bookmark, star (a star is GitHub's)

## Appearance

**Appearance**:
The user's choice of Auto, Light or Dark. Auto follows GitHub's own appearance setting.
_Avoid_: Mode, color scheme, theme

**Theme**:
A named pair of palettes, one for light and one for dark. It is a preset (Unmerged, Graphite, Paper…) or a
custom theme that the user makes.
_Avoid_: Skin, color scheme, appearance

**Palette**:
The full set of colors that a theme uses in one appearance.
_Avoid_: Colors, tokens

**Seed**:
One of the two colors per appearance, a background and an accent, from which Unmerged derives a palette.
_Avoid_: Base color, primary color

## Account

**Token**:
The GitHub personal access token that the user gives Unmerged. Unmerged sends it only to GitHub's API.
_Avoid_: Key, PAT, credential

**Account**:
The GitHub user that the token belongs to. Cached data is kept for each account.
_Avoid_: User, profile, login
