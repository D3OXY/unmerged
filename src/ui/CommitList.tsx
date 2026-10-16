import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Copy01Icon, FolderTreeIcon } from '@hugeicons/core-free-icons';
import type { Actor, CheckState } from '@/github/types';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { fullDate, timeAgo } from '@/lib/time';
import { Avatar, Panel, SectionHeader } from './primitives';
import { CheckIcon } from './status';

export const COMMIT_ROW_FIELDS = /* GraphQL */ `
  fragment CommitRow on Commit {
    oid abbreviatedOid messageHeadline messageBody committedDate additions deletions
    author { name user { login avatarUrl } }
    signature { isValid }
    statusCheckRollup {
      state
      contexts(first: 0) {
        checkRunCount checkRunCountsByState { state count }
        statusContextCount statusContextCountsByState { state count }
      }
    }
  }
`;

type StateCount = { state: string; count: number };

export type CommitRowData = {
  oid: string;
  abbreviatedOid: string;
  messageHeadline: string;
  messageBody: string;
  committedDate: string;
  additions: number;
  deletions: number;
  author: { name: string | null; user: Actor } | null;
  signature: { isValid: boolean } | null;
  statusCheckRollup: {
    state: CheckState;
    contexts: { checkRunCount: number; checkRunCountsByState: StateCount[] | null; statusContextCount: number; statusContextCountsByState: StateCount[] | null };
  } | null;
};

type Props = {
  commits: CommitRowData[];
  /** "owner/repo" the commits belong to; `#123` references and "browse files" point into it. */
  nameWithOwner: string;
  /** Where a commit's headline leads; defaults to GitHub's commit page. */
  commitHref?: (oid: string) => string;
};

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Commits grouped by day in the order given, Linear-style rows with expandable messages. */
export function CommitList({ commits, nameWithOwner, commitHref = (oid) => `/${nameWithOwner}/commit/${oid}` }: Props) {
  const days = Map.groupBy(commits, (commit) => dayFormat.format(new Date(commit.committedDate)));
  return (
    <div className="flex flex-col gap-6">
      {[...days].map(([day, dayCommits]) => (
        <section key={day}>
          <SectionHeader title={day} count={dayCommits.length} />
          <Panel className="overflow-hidden">
            {dayCommits.map((commit) => (
              <CommitRow key={commit.oid} commit={commit} nameWithOwner={nameWithOwner} href={commitHref(commit.oid)} />
            ))}
          </Panel>
        </section>
      ))}
    </div>
  );
}

// Check runs that finished without failing; GitHub counts these toward "4 / 4".
const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

/** A commit's checks as passed and total, the way GitHub counts them ("4 / 4"). */
export function checkCounts({ contexts }: NonNullable<CommitRowData['statusCheckRollup']>) {
  return {
    total: contexts.checkRunCount + contexts.statusContextCount,
    passed: [...(contexts.checkRunCountsByState ?? []), ...(contexts.statusContextCountsByState ?? [])]
      .filter((s) => PASSING.has(s.state))
      .reduce((sum, s) => sum + s.count, 0),
  };
}

function CommitRow({ commit, nameWithOwner, href }: { commit: CommitRowData; nameWithOwner: string; href: string }) {
  const [open, setOpen] = useState(false);
  const user = commit.author?.user;
  const rollup = commit.statusCheckRollup;
  const checks = rollup && checkCounts(rollup);

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="flex min-h-12 items-center gap-3 px-4 py-2">
        <Avatar src={user?.avatarUrl} size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Headline text={commit.messageHeadline} href={href} nameWithOwner={nameWithOwner} />
            {commit.messageBody && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Show full message"
                className="flex h-5 cursor-pointer items-center rounded px-1 text-subtle hover:bg-hover hover:text-fg"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className={cx('size-3.5 transition-transform', open && 'rotate-180')} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-subtle">
            <span>
              <CommitPerson person={commit.author} /> committed <span title={fullDate(commit.committedDate)}>{timeAgo(commit.committedDate)}</span>
            </span>
            {checks && checks.total > 0 && (
              <span className="flex items-center gap-1 tabular-nums" title={`${checks.passed} of ${checks.total} checks passed`}>
                · <CheckIcon state={rollup.state} className="size-3" />
                {checks.passed} / {checks.total}
              </span>
            )}
          </div>
        </div>
        {commit.signature?.isValid && (
          <span className="hidden h-5 items-center rounded-full border border-success/30 px-2 text-[11px] font-medium text-success sm:flex" title="Signed with a verified signature">
            Verified
          </span>
        )}
        <span className="hidden font-mono text-[11.5px] tabular-nums sm:block">
          <span className="text-success">+{commit.additions}</span> <span className="text-danger">−{commit.deletions}</span>
        </span>
        <button
          type="button"
          onClick={() => copy(commit.oid, 'commit SHA')}
          title="Copy full SHA"
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-elevated px-2 font-mono text-[11.5px] text-muted hover:border-line-strong hover:text-fg"
        >
          {commit.abbreviatedOid}
          <HugeiconsIcon icon={Copy01Icon} className="size-3" />
        </button>
        <a
          href={`/${nameWithOwner}/tree/${commit.oid}`}
          title="Browse files at this commit"
          className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={FolderTreeIcon} className="size-3.5" />
        </a>
      </div>
      {open && (
        <pre className="mx-4 mb-3 ml-[50px] animate-enter rounded-lg bg-elevated px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">
          {commit.messageBody}
        </pre>
      )}
    </div>
  );
}

/** A commit's author or committer: their profile (an app's page for bots), or the name in the commit when no account matches. */
export function CommitPerson({ person }: { person: CommitRowData['author'] }) {
  const user = person?.user;
  if (!user) return <span className="text-muted">{person?.name}</span>;
  return (
    <a href={user.login.endsWith('[bot]') ? `/apps/${user.login.slice(0, -5)}` : `/${user.login}`} className="text-muted hover:text-fg hover:underline">
      {user.login}
    </a>
  );
}

/** The headline links to the commit, except `#123` references, which link to their issue or PR (GitHub redirects). */
function Headline({ text, href, nameWithOwner }: { text: string; href: string; nameWithOwner: string }) {
  // Splitting on a capture group puts the reference numbers at odd indexes.
  const parts = text.split(/#(\d+)\b/);
  const rowIndex = parts.findIndex((part, i) => i % 2 === 0 && part);
  return (
    <span className="truncate text-[13px] font-medium">
      {parts.map((part, i) =>
        i % 2 ? (
          <a key={i} href={`/${nameWithOwner}/issues/${part}`} className="text-accent hover:underline">
            #{part}
          </a>
        ) : (
          part && (
            <a key={i} href={href} data-row={i === rowIndex || undefined} className="hover:underline focus:underline focus:outline-none">
              {part}
            </a>
          )
        ),
      )}
    </span>
  );
}
