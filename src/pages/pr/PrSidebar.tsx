import { useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Cancel01Icon, Clock01Icon, Comment01Icon, MinusSignIcon, RefreshIcon, Settings02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { gql } from '@/github/client';
import { useViewer } from '@/github/viewer';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { useDebounced } from '@/lib/useDebounced';
import { Button } from '@/ui/Button';
import { Menu, type MenuOption } from '@/ui/Menu';
import { diffAnchor } from './files/anchor';
import { statusDot } from './files/status';
import { Avatar, Panel, Pill } from '@/ui/primitives';
import { CheckIcon, IssueIcon } from '@/ui/status';
import { checkName, checkUrl, outcomeOf, type CheckOutcome } from './checks';
import { IssuePicker } from '@/pages/issue/IssuePicker';
import { useLinkPullRequest } from '@/pages/issue/useLinkPullRequest';
import { EDIT_MUTATIONS, repoPath, type CheckContext, type PrWithReview, type ReviewState } from './query';
import { usePrMutation } from './usePrMutation';

const ORDER: Record<CheckOutcome, number> = { FAILURE: 0, PENDING: 1, SUCCESS: 2, NEUTRAL: 3 };

/** CI checks, failures first; passing ones fold away when there are many. */
export function ChecksCard({ checks }: { checks: CheckContext[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!checks.length) return null;
  const sorted = [...checks].sort((a, b) => ORDER[outcomeOf(a)] - ORDER[outcomeOf(b)]);
  const loud = sorted.filter((c) => outcomeOf(c) === 'FAILURE' || outcomeOf(c) === 'PENDING');
  const visible = expanded ? sorted : loud.slice(0, 6);
  const rest = sorted.length - visible.length;

  return (
    <Card title="Checks" count={checks.length}>
      <div className="flex flex-col">
        {visible.map((check) => {
          const outcome = outcomeOf(check);
          const url = checkUrl(check);
          return (
            <a
              key={check.id}
              href={url ?? undefined}
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[12.5px] hover:bg-hover"
            >
              {outcome === 'NEUTRAL' ? <HugeiconsIcon icon={MinusSignIcon} className="size-3.5 text-subtle" /> : <CheckIcon state={outcome} />}
              <span className={cx('min-w-0 flex-1 truncate', outcome === 'FAILURE' ? 'font-medium text-fg' : 'text-fg/85')}>{checkName(check)}</span>
              {check.isRequired && <span className="text-[10.5px] font-medium tracking-wide text-subtle uppercase">Req</span>}
            </a>
          );
        })}
        {rest > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[12.5px] text-muted hover:bg-hover">
            {loud.length > visible.length ? <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" /> : <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-success" />}
            {loud.length > visible.length ? `Show all ${sorted.length}` : `${rest} successful or skipped`}
          </button>
        )}
      </div>
    </Card>
  );
}

const REVIEW_ICON: Partial<Record<ReviewState, ReactNode>> = {
  APPROVED: <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-success" strokeWidth={2.5} />,
  CHANGES_REQUESTED: <HugeiconsIcon icon={Cancel01Icon} className="size-3.5 text-danger" strokeWidth={2.5} />,
  COMMENTED: <HugeiconsIcon icon={Comment01Icon} className="size-3.5 text-subtle" />,
};

/** Reviewers, assignees and labels. People who may triage the PR can change them in place. */
export function PeopleCard({ pr, queryKey }: { pr: PrWithReview; queryKey: QueryKey }) {
  const viewer = useViewer().data?.login;
  const reviewed = pr.latestOpinionatedReviews.nodes.flatMap(({ author, state }) => (author ? [{ author, state }] : []));
  const requested = pr.reviewRequests.nodes.flatMap(({ requestedReviewer: r }) =>
    r && r.__typename !== 'Mannequin' ? [{ name: 'login' in r ? r.login : r.name, avatarUrl: r.avatarUrl }] : [],
  );
  // GitHub has no separate permission for review requests; it's the same triage access as assigning.
  const canRequest = pr.state === 'OPEN' && pr.viewerCanAssign;
  // The author and the viewer can't be asked to review; pending requests already have been.
  const unaskable = [pr.author?.login, viewer, ...requested.map((r) => r.name)];

  return (
    <Card title="People">
      <Field
        label="Reviewers"
        action={canRequest && <Picker pr={pr} queryKey={queryKey} kind="users" title="Request reviewers" add={EDIT_MUTATIONS.requestReviews} selected={[]} hide={unaskable} />}
      >
        {reviewed.length + requested.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
        {reviewed.map(({ author, state }) => (
          <Person
            key={author.login}
            name={author.login}
            avatarUrl={author.avatarUrl}
            trailing={
              <>
                {canRequest && author.id && !unaskable.includes(author.login) && <ReRequest prId={pr.id} userId={author.id} queryKey={queryKey} />}
                {REVIEW_ICON[state]}
              </>
            }
          />
        ))}
        {requested.map((r) => (
          <Person key={r.name} name={r.name} avatarUrl={r.avatarUrl} trailing={<HugeiconsIcon icon={Clock01Icon} className="size-3.5 text-warning" />} />
        ))}
      </Field>
      <Field
        label="Assignees"
        action={
          pr.viewerCanAssign && (
            <Picker
              pr={pr}
              queryKey={queryKey}
              kind="users"
              title="Assign people"
              add={EDIT_MUTATIONS.addAssignees}
              remove={EDIT_MUTATIONS.removeAssignees}
              selected={pr.assignees.nodes.map((a) => ({ value: a.id, label: a.login }))}
            />
          )
        }
      >
        {pr.assignees.nodes.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
        {pr.assignees.nodes.map((a) => (
          <Person key={a.login} name={a.login} avatarUrl={a.avatarUrl} />
        ))}
      </Field>
      {(pr.labels.nodes.length > 0 || pr.viewerCanLabel) && (
        <Field
          label="Labels"
          action={
            pr.viewerCanLabel && (
              <Picker
                pr={pr}
                queryKey={queryKey}
                kind="labels"
                title="Edit labels"
                add={EDIT_MUTATIONS.addLabels}
                remove={EDIT_MUTATIONS.removeLabels}
                selected={pr.labels.nodes.map((l) => ({ value: l.id, label: l.name }))}
              />
            )
          }
        >
          {pr.labels.nodes.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
          <div className="flex flex-wrap gap-1.5 px-2 pt-0.5">
            {pr.labels.nodes.map((l) => (
              <Pill key={l.name} color={l.color}>
                {l.name}
              </Pill>
            ))}
          </div>
        </Field>
      )}
    </Card>
  );
}

/** Asks a past reviewer to look again, e.g. after pushing fixes. */
function ReRequest({ prId, userId, queryKey }: { prId: string; userId: string; queryKey: QueryKey }) {
  const request = usePrMutation(queryKey);
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Re-request review"
      title="Re-request review"
      loading={request.isPending}
      icon={<HugeiconsIcon icon={RefreshIcon} className="size-3.5" />}
      onClick={() => request.mutate({ query: EDIT_MUTATIONS.requestReviews, variables: { id: prId, ids: [userId] }, success: 'Review re-requested' })}
      className={cx('size-6 group-hover/person:opacity-100 focus-visible:opacity-100', !request.isPending && 'opacity-0')}
    />
  );
}

const CANDIDATES_QUERY = /* GraphQL */ `
  query PrPickerCandidates($owner: String!, $repo: String!, $q: String!, $labels: Boolean!) {
    repository(owner: $owner, name: $repo) {
      assignableUsers(first: 20, query: $q) @skip(if: $labels) { nodes { id login name } }
      labels(first: 30, query: $q) @include(if: $labels) { nodes { id name description } }
    }
  }
`;

type Candidates = {
  repository: {
    assignableUsers?: { nodes: { id: string; login: string; name: string | null }[] };
    labels?: { nodes: { id: string; name: string; description: string | null }[] };
  } | null;
};

/**
 * What the picker lists: the current selection first (unless searching, when only matches show), then the
 * candidates, each once, minus any whose label is in `hide`.
 */
export function pickerOptions(selected: MenuOption<string>[], candidates: MenuOption<string>[], search: string, hide: (string | null | undefined)[]) {
  return [...(search ? [] : selected), ...candidates].filter((option, i, all) => !hide.includes(option.label) && all.findIndex((o) => o.value === option.value) === i);
}

/**
 * Searchable multi-select over the repo's assignable users or labels (option values are node ids). A pick
 * applies at once, `add` or (if it was selected) `remove`, and shows as done while the PR refetches.
 * Options whose label is in `hide` aren't offered.
 */
function Picker({
  pr,
  queryKey,
  kind,
  title,
  add,
  remove,
  selected,
  hide = [],
}: {
  pr: PrWithReview;
  queryKey: QueryKey;
  kind: 'users' | 'labels';
  title: string;
  add: string;
  remove?: string;
  selected: MenuOption<string>[];
  hide?: (string | null | undefined)[];
}) {
  // Candidates load once the menu first opens, not on every page view.
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 200);
  const [owner, repo] = repoPath(pr).split('/');
  const candidates = useQuery({
    queryKey: ['pr-picker', owner, repo, kind, q],
    queryFn: async () => {
      const { repository } = await gql<Candidates>(CANDIDATES_QUERY, { owner, repo, q, labels: kind === 'labels' });
      return [
        ...(repository?.assignableUsers?.nodes ?? []).map((u): MenuOption<string> => ({ value: u.id, label: u.login, hint: u.name ?? undefined })),
        ...(repository?.labels?.nodes ?? []).map((l): MenuOption<string> => ({ value: l.id, label: l.name, hint: l.description ?? undefined })),
      ];
    },
    enabled: opened,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const mutation = usePrMutation(queryKey);
  const [inFlight, setInFlight] = useState<string[]>([]);

  const isSelected = (id: string) => selected.some((o) => o.value === id);
  const options = pickerOptions(selected, candidates.data ?? [], search, hide);

  const toggle = (id: string) => {
    const query = isSelected(id) ? remove : add;
    if (!query || inFlight.includes(id)) return;
    setInFlight((ids) => [...ids, id]);
    mutation
      .mutateAsync({ query, variables: { id: pr.id, ids: [id] } })
      .catch(() => {}) // usePrMutation already toasted it.
      .finally(() => setInFlight((ids) => ids.filter((x) => x !== id)));
  };

  return (
    <Menu<string>
      value={options.map((o) => o.value).filter((id) => isSelected(id) !== inFlight.includes(id))}
      options={options}
      onChange={toggle}
      header={
        <div className="p-1 pb-1.5">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={kind === 'labels' ? 'Filter labels' : 'Search people'}
            className="h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[12.5px] outline-none focus:border-accent/60"
          />
          {options.length === 0 && <p className="px-1.5 pt-2 text-[12px] text-subtle">{candidates.isFetching ? 'Searching…' : 'No matches'}</p>}
        </div>
      }
      trigger={(open) => (
        <button
          type="button"
          aria-label={title}
          title={title}
          onClick={() => {
            setOpened(true);
            open();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-subtle hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
        </button>
      )}
    />
  );
}

/**
 * Issues this PR closes when it merges. While it's open, people who can edit it link another issue of the repo
 * ("Closes #<issue>" in its description). GitHub reads that keyword only in a PR into the default branch.
 */
export function LinkedIssuesCard({ pr, queryKey }: { pr: PrWithReview; queryKey: QueryKey }) {
  const issues = pr.closingIssuesReferences.nodes;
  const link = useLinkPullRequest(queryKey);
  const linkable = pr.state === 'OPEN' && pr.viewerCanUpdate && pr.baseRefName === pr.baseRepository?.defaultBranchRef?.name;
  if (!issues.length && !linkable) return null;
  return (
    <Card
      title="Linked issues"
      count={issues.length || undefined}
      action={
        linkable && (
          <IssuePicker
            repo={repoPath(pr)}
            kind="issue"
            title="Link an issue"
            hide={issues.map((issue) => issue.id)}
            onPick={(issue) => link.mutate({ pr: pr.id, issue: issue.number })}
          />
        )
      }
    >
      {issues.length === 0 && <p className="px-2 pb-1 text-[12.5px] text-subtle">None</p>}
      {issues.map((issue) => (
        <a
          key={issue.url}
          href={issue.url}
          title={`${issue.repository.nameWithOwner}#${issue.number}`}
          className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] hover:bg-hover"
        >
          <IssueIcon state={issue.state} stateReason={issue.stateReason} className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">{issue.title}</span>
          <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">#{issue.number}</span>
        </a>
      ))}
    </Card>
  );
}

async function openFile(prUrl: string, path: string) {
  navigate(`${prUrl}/files#${await diffAnchor(path)}`);
}

export function FilesCard({ pr }: { pr: PrWithReview }) {
  const [all, setAll] = useState(false);
  const files = all ? pr.files.nodes : pr.files.nodes.slice(0, 10);
  if (!files.length) return null;

  return (
    <Card title="Files" count={pr.files.totalCount}>
      {files.map((file) => {
        const slash = file.path.lastIndexOf('/');
        return (
          <button
            key={file.path}
            type="button"
            onClick={() => openFile(pr.url, file.path)}
            title={file.path}
            className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[12px] hover:bg-hover"
          >
            <span className={cx('size-1.5 shrink-0 rounded-full', statusDot(file.changeType))} />
            <span className="min-w-0 flex-1 truncate font-mono">
              <span className="text-subtle">{file.path.slice(0, slash + 1)}</span>
              {file.path.slice(slash + 1)}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums">
              <span className="text-success">+{file.additions}</span> <span className="text-danger">−{file.deletions}</span>
            </span>
          </button>
        );
      })}
      {!all && pr.files.nodes.length > 10 && (
        <button type="button" onClick={() => setAll(true)} className="h-7 w-full cursor-pointer rounded-md px-2 text-left text-[12px] text-muted hover:bg-hover">
          Show {pr.files.nodes.length - 10} more
        </button>
      )}
    </Card>
  );
}

export function Card({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <Panel className="p-2">
      <div className="flex h-7 items-center gap-1.5 px-2 text-[12px] font-medium text-muted">
        {title}
        {count !== undefined && <span className="font-normal text-subtle tabular-nums">{count}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </Panel>
  );
}

export function Field({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-2 pb-0.5 text-[11px] text-subtle">
        {label}
        {action}
      </div>
      {children}
    </div>
  );
}

export function Person({ name, avatarUrl, trailing }: { name: string; avatarUrl: string | null; trailing?: ReactNode }) {
  return (
    <div className="group/person flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px]">
      <Avatar src={avatarUrl} size={18} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {trailing}
    </div>
  );
}
