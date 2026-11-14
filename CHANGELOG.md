# unmerged

## 0.1.6 (2026-11-14)

### Patch Changes

- [Improved][Speed] When you open a page again in a new tab or reload it soon after, Unmerged shows the data it loaded a short time ago and does not ask GitHub for it again. Pages show sooner, and Unmerged uses less of your GitHub API limit.
- [Improved][Repositories] The Overview shows the latest commit above the README, with its author, check status and a link to the full history.
- [Fixed][WebKit browsers] A page that Unmerged shows sometimes stayed blank with only the background color. It now shows every time.

## 0.1.5 (2026-11-08)

### Patch Changes

- [New][Repositories] A repository's front page is now an Overview that shows its README at the top, without the file list. The files are in a new Files tab. To get the old Code tab back, turn off "Overview tab" in settings.
- [Improved][Pull requests] Slide to merge is now a card that shows the merge method, what it does, and the branches it merges. Click the method to change it. A wider handle makes the slide easier.

## 0.1.4 (2026-11-03)

### Patch Changes

- [Fixed][Settings] "Change token" in the Settings dialog on GitHub now closes the dialog and opens the token form in a new tab. When you save or cancel, the tab closes and you are back on GitHub.
- [Fixed][Updates] After Unmerged updates, a page that Unmerged shows in a tab that was already open reloads with the new version. Before, the page could go blank.
- [Improved][Privacy] By default, Privacy now blurs only email addresses. You can turn on blur for organizations, private repository names, commit messages and titles in Settings.
- [Improved][Settings] The "Create a token" link now sets the token to never expire, so Unmerged doesn't stop working without warning. You can still pick a date on GitHub's form. A new "Why a token?" link explains why Unmerged needs a token, where the token goes, and how to limit or revoke it.

## 0.1.3 (2026-11-02)

### Patch Changes

- [New][Sidebar] Click your name in the sidebar to open GitHub's account menu: profile, repositories, stars, settings, sign out and more.
- [Fixed][Actions] A workflow run that waits for a maintainer's approval now shows a yellow warning, as on GitHub, not a red failure. Checks that wait for approval on a pull request show the same warning.
- [Fixed][Actions] A cancelled workflow run or job now shows a gray stop icon, as on GitHub, not a red failure. A cancelled check on a pull request shows the same icon, and the merge box says "cancelled check", not "failing check".
- [Improved][Profiles & organizations] Hover a day in the contribution graph to see its count and full date in a clear tooltip, which shows at once.
- [Improved][Pull requests] An open pull request uses about half as much of your GitHub API limit while CI runs. After two minutes, check results update every 30 seconds.
- [New][Pull requests] Files changed has a Filter menu, as on GitHub: hide viewed files, deleted files, or files of a type such as `.lock`. A new setting, Keep file filters, keeps the filters after a reload: in the page's URL, or for all pull requests. It is off by default.
- [New][Pull requests] Comments have a menu, as on GitHub: copy a comment's link, quote it in your reply, or hide it as outdated, resolved, off-topic, spam and more. Hidden comments stay folded until you show them, and comments show the author's role and an "edited" mark. Every comment box has a Preview tab, and with text in the box, Close becomes Close with comment.
- [New][Pull requests] Files changed can show the changes since your last review, one commit, or a span of commits (Shift-click), from the new commit menu. These views use GitHub's URLs, so links to them open in Unmerged, and you can comment on the new lines when the commits go up to the latest one.
- [New][Pull requests] A long conversation can load its older activity: "Load more" adds the next 100 events from the start, as on GitHub, so you no longer need classic GitHub to read them.
- [Fixed][Pull requests] A comment on a whole file no longer shows as a comment on line 1.
- [New][Pull requests] In Files changed, you can comment on a whole file with the comment button in the file's header, as a single comment or as part of your review. Comments on a whole file show above the file's diff.
- [New][Pull requests] Typing @ in a comment suggests people who can be mentioned in the repository. Use the arrow keys and Enter or Tab to pick one, or click it.
- [New][Pull requests] The pencil next to the base branch changes it. The merge box can update a branch with a rebase, revert a merged pull request, restore a deleted branch and convert an open pull request to a draft. The timeline shows more events: base branch changes, milestones, locks, merge queue, deployments, restored branches, removed review requests and commits that reference the pull request.
- [New][Pull requests] The sidebar shows the pull request's projects with their status. You can change the status, and add the pull request to a project or remove it. A token needs the `project` scope for this; the "Create a token" link now asks for it.
- [New][Pull requests] Submit or discard your review from Files changed with the new Review button, and open a file in GitHub's editor with the pencil on its header. The Checks tab can re-run all jobs of a workflow and approve a fork's workflows that wait to run.
- [New][Pull requests] The sidebar shows and sets the milestone, removes review requests, subscribes you to or unsubscribes you from the pull request, shows its participants, and lets maintainers lock and unlock the conversation.
- [New][Pull requests] You can request a review from a team: the reviewer picker lists the organization's teams that have access to the repository, next to people.
- [Fixed][Pull requests] When a pull request changes more than 3,000 files, Files changed now tells you that GitHub lists only the first 3,000, and how many more files there are. The sidebar's Files card now shows the full count.

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
