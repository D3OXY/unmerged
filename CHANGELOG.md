# unmerged

## 0.1.2 (2026-10-21)

### Patch Changes

- [New][Repositories] A file on a branch has an Edit button (or press E) that opens GitHub's editor.
- [Improved][Pull request & issue lists] Issue lists show as a table, like pull request lists, with comments and sortable columns. To keep the open issue beside a compact list, turn on Split issue lists in settings.
- [New][Issues] Issues show their parent issue, sub-issues with progress, and the issues they are blocked by or blocking, with these events in the activity. With triage access, you can add and remove them in place.
- [New][Pull requests] Link an issue to a pull request, or a pull request to an issue, from the sidebar. Unmerged adds "Closes #<issue>" to the pull request's description.
- [New][Pull request & issue lists] Issue rows show when an issue is blocked, and how many of its sub-issues are closed.
- [New][Pull request & issue lists] Turn on Nest sub-issues in settings to show each parent issue with all its sub-issues under it, in the same order as on GitHub.
- [Fixed][Updates] After Unmerged updates, links in tabs that were already open load the new version, and no longer do nothing or show errors.
- [Fixed][Account] Your account, organizations and recent repositories, private ones too, are no longer kept where github.com's scripts and other extensions can read them.

## 0.1.1 (2026-10-20)

### Patch Changes

- [New][Actions] The Actions page opens in Unmerged: every workflow's runs or one workflow's, with GitHub's filters (is:, branch:, event:, actor:), a status menu, and runs that update while they're in progress.
- [Improved][Speed] Pages that Unmerged shows open sooner when you open them in a new tab, reload them or follow a link from another site: Unmerged no longer waits for GitHub to build its full page (up to 7 seconds on a very large pull request). Chrome only for now.
- [Improved][Pull requests] Files changed, commits and comparisons show diffs sooner. The text of a diff shows at once, and its colors follow a moment later. Highlighting no longer blocks scrolling or typing.
- [Improved][Speed] Pages you open from the address bar, a bookmark or another site load sooner: their data starts loading as soon as you open the link, instead of after GitHub's own page starts to arrive.
- [Improved][Pull request & issue lists] Pull request and issue lists show their rows sooner, in about a second instead of about five. Review, CI, size and comments fill in a moment later.
- [Improved][Pull requests] On a large pull request, Files changed shows the header and the first diffs sooner. It no longer waits for the full pull request to load. Line comments become available a moment later.
- [Fixed][Pull requests] Files changed shows the latest push right away, instead of the diff from a minute before.
- [Improved][Pull requests] Files changed on a pull request with thousands of files opens without freezing the page.
- [Improved][Issues] An issue opens faster. Its description, details and newest comments show first, and older comments and events show a moment later.
- [Improved][Issues] Issue lists keep the open issue beside them, with its labels, assignees and milestone under the title; j/k moves through the list.
- [Improved][Speed] Images in issues, pull requests, comments, READMEs and release notes load when you scroll near them, not all at once. A long issue with many screenshots loads much less data, and uploaded images keep their shape and space while they load.
- [Improved][Speed] GitHub's own pages, the ones that Unmerged leaves to GitHub, open as fast as without the extension: Unmerged's code no longer runs on them.
- [Improved][Settings] The on/off switches in settings move like a drop of liquid: the knob springs across and stretches while it moves.
- [Improved][Pull requests] A pull request shows its description about three times sooner on a first visit. The merge box, checks, reviews and activity fill in as each one loads, and the Commits and Checks tabs no longer wait for the whole pull request.
- [Improved][Pull requests] Pull request lists are a table: review, CI, size and comments in columns, with filters and sorting in the headers.
- [Improved][Pull request & issue lists] A pull request or issue in a list opens almost at once, also without a hover. When a list (Pull requests, Issues, a repository's lists, Notifications) stays still for a moment, Unmerged gets the first 10 rows on screen ready. It does not do this on touch-only devices, with Data Saver, or on a slow connection.
- [New][Settings] Privacy blurs details you may not want to show when you share your screen: organizations in the sidebar and on profiles, the names of private repositories, commit messages and pull request and issue titles in private repositories, and email addresses. Hover a detail to show it. Privacy is on by default; turn it off, or choose what it blurs, in Settings → Privacy.
- [Improved][Pull requests] Files changed on a large pull request shows the first diffs as soon as they load, instead of after every file is in.
- [New][Repositories] Releases and tags open in Unmerged: every release with its notes, assets and reactions, one release or the latest, and every tag with its commit and source code downloads.
- [Improved][Repositories] Go to file and the Code menu sit on the branch row, so the sidebar starts with About.
- [New][Repositories] Contributors open in Unmerged: commits, additions and deletions per week over any period, ranked by author, for private repositories too.
- [Improved][Repositories] Repository lists filter by type, language and topic from a rail beside the list.
- [Fixed][Repositories] The activity cards on a repository's front page fit with any font and repository size, keep still when you hover a week, and line up with each other.
- [New][Repositories] A repository's front page opens with its last 12 weeks: commits, merged pull requests, issues and lines changed per week, CI on the default branch, and the latest release. Turn it off in Settings → General.
- [New][Pull requests] Slide to merge: when a pull request is ready to merge, a slider in the bottom-right corner merges it from any tab. You can turn it off in settings.
- [Improved][Pull requests] On pull requests with many files, Viewed marks load in two requests instead of one request for every 100 files.

## 0.1.0 (2026-10-18)

The first release: Unmerged re-skins github.com in place, with the same URLs and session.

- [New][Home] Home sorts your pull requests by what they need; the sidebar keeps recent and pinned repositories.
- [New][Profiles] Profiles open in Unmerged, with repositories, achievements, followers and following tabs.
- [New][Organizations] Organizations open in Unmerged: an overview with the README, pinned repositories and people, plus repository and people lists.
- [New][Repositories] Repositories open in Unmerged: files, READMEs that look like GitHub's, commit history, permalinks with y, and a description, website and topics you can edit.
- [New][Branches] Branches open in Unmerged: yours, active, stale and all, with checks, behind/ahead counts, pull requests, search, new branch, and delete with restore.
- [New][Pull requests] Pull requests open in Unmerged: the full timeline, commits, checks and files changed, with reviewers, assignees, labels, title and description edited in place.
- [New][Pull requests] Review as on GitHub, but faster: line comments batched into one review, saved drafts, suggested changes and n/p/v/] keys, even on big pull requests.
- [New][Commits] Commits open in Unmerged: the full message, checks, parents and the diff viewer.
- [New][Compare] Compare branches and open a pull request in Unmerged, with branch pickers, a merge hint, commits and the diff.
- [New][Issues] Issues open in Unmerged: the timeline, comments, close as completed or not planned, and linked pull requests.
- [New][Issues] New issue opens in Unmerged with a template chooser and Markdown templates; YAML forms stay on GitHub.
- [New][Lists] Pull request and issue lists, yours and each repository's, with filter chips; a row opens in a side panel beside the list, or full screen on double-click.
- [New][Workflow runs] Workflow runs and job logs open in Unmerged: jobs, steps, logs scrolled to the failure, attempts and re-run.
- [New][Notifications] Notifications open in Unmerged: inbox, unread and participating, with bulk actions and filters.
- [New][Search] Search opens in Unmerged: repositories, code, issues, pull requests, users and commits, with counts and sorting.
- [New][Media] Images and videos in Markdown open in a viewer over the page, and links to video files play inline, loading nothing until you press play.
- [New][Speed] Pages load up to 8× faster: GitHub's own page never loads underneath, links prefetch on hover, and results are cached across visits.
- [New][Appearance] Light and dark mode that follows GitHub's setting, seven themes or your own from two colors, and a Default, Serif or Mono font.
- [New][Shortcuts] ⌘K opens a palette of commands, repositories, people and your pull requests and issues; ? lists every shortcut on the page.
- [New][Settings] Each page can be switched off from the toolbar popup, and Classic shows GitHub's page for the current URL.
- [New][Account] The token is entered only in the extension, and Disconnect deletes everything cached for it.
