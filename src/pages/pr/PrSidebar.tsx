import { useState, type ReactNode } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon, Cancel01Icon, Clock01Icon, Comment01Icon, SquareLock01Icon, MilestoneIcon, Notification01Icon, NotificationOff01Icon, RefreshIcon,
  Settings02Icon, Tick02Icon, SquareUnlock01Icon,
} from '@hugeicons/core-free-icons';
import type { Actor } from '@/github/types';
import { gql, rest } from '@/github/client';
import { useViewer } from '@/github/viewer';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { useDebounced } from '@/lib/useDebounced';
import { Button } from '@/ui/Button';
import { Menu, type MenuOption } from '@/ui/Menu';
import { diffAnchor } from './files/anchor';
import { statusDot } from './files/status';
import { Avatar, Panel, Pill } from '@/ui/primitives';
import { IssueIcon } from '@/ui/status';
import { toast } from '@/ui/toast';
import { checkName, checkUrl, ORDER, outcomeOf } from './checks';
import { OutcomeIcon } from './ChecksTab';
import { IssuePicker } from '@/pages/issue/IssuePicker';
import { useLinkPullRequest } from '@/pages/issue/useLinkPullRequest';
import { ProjectsField } from './Projects';
import { EDIT_MUTATIONS, repoPath, type CheckContext, type LockReason, type PrWithReview, type ReviewState } from './query';
import { usePrMutation } from './usePrMutation';

/** CI checks, failures first; passing ones fold away when there are many. */
export function ChecksCard({ checks }: { checks: CheckContext[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!checks.length) return null;
  const sorted = [...checks].sort((a, b) => ORDER[outcomeOf(a)] - ORDER[outcomeOf(b)]);
  const loud = sorted.filter((c) => ORDER[outcomeOf(c)] < ORDER.SUCCESS);
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
              <OutcomeIcon outcome={outcome} />
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

/** Reviewers, assignees, labels, milestone and projects. People who may triage the PR can change them in place. */
export function PeopleCard({ pr, queryKey }: { pr: PrWithReview; queryKey: QueryKey }) {
  const viewer = useViewer().data?.login;
  const reviewed = pr.latestOpinionatedReviews.nodes.flatMap(({ author, state }) => (author ? [{ author, state }] : []));
  // `team`: a team's slug, which the REST API takes to remove its request.
  const requested = pr.reviewRequests.nodes.flatMap(({ requestedReviewer: r }) =>
    r && r.__typename !== 'Mannequin' ? [r.__typename === 'Team' ? { name: r.name, avatarUrl: r.avatarUrl, team: r.slug } : { name: r.login, avatarUrl: r.avatarUrl }] : [],
  );
  // GitHub has no separate permission for review requests; it's the same triage access as assigning.
  const canRequest = pr.state === 'OPEN' && pr.viewerCanAssign;
  // The author and the viewer can't be asked to review; pending requests already have been.
  const unaskable = [pr.author?.login, viewer, ...requested.map((r) => r.name)];

  return (
    <Card title="Details">
      <Field
        label="Reviewers"
        action={canRequest && <Picker pr={pr} queryKey={queryKey} kind="reviewers" title="Request reviewers" add={EDIT_MUTATIONS.requestReviews} selected={[]} hide={unaskable} />}
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
          <Person
            key={r.name}
            name={r.name}
            avatarUrl={r.avatarUrl}
            trailing={
              <>
                {canRequest && <RemoveRequest pr={pr} reviewer={r} queryKey={queryKey} />}
                <HugeiconsIcon icon={Clock01Icon} className="size-3.5 text-warning" />
              </>
            }
          />
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
      {(pr.milestone || pr.viewerCanAssign) && (
        <Field label="Milestone" action={pr.viewerCanAssign && <MilestonePicker pr={pr} queryKey={queryKey} />}>
          {pr.milestone ? (
            <a href={pr.milestone.url} className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] hover:bg-hover">
              <HugeiconsIcon icon={MilestoneIcon} className="size-3.5 shrink-0 text-subtle" />
              <span className="truncate">{pr.milestone.title}</span>
            </a>
          ) : (
            <span className="px-2 text-[12.5px] text-subtle">None</span>
          )}
        </Field>
      )}
      <ProjectsField pr={pr} />
    </Card>
  );
}

/** Takes back a pending review request, from a person or a team. GraphQL has no mutation for it; REST does. */
function RemoveRequest({ pr, reviewer, queryKey }: { pr: PrWithReview; reviewer: { name: string; team?: string }; queryKey: QueryKey }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () =>
      rest(`/repos/${repoPath(pr)}/pulls/${pr.number}/requested_reviewers`, {
        method: 'DELETE',
        body: reviewer.team ? { reviewers: [], team_reviewers: [reviewer.team] } : { reviewers: [reviewer.name] },
      }),
    onSuccess: () => {
      toast.success('Review request removed');
      return queryClient.invalidateQueries({ queryKey });
    },
    onError: toast.error,
  });
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Remove review request for ${reviewer.name}`}
      title="Remove review request"
      loading={remove.isPending}
      icon={<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />}
      onClick={() => remove.mutate()}
      className={cx('size-6 group-hover/person:opacity-100 focus-visible:opacity-100', !remove.isPending && 'opacity-0')}
    />
  );
}

const MILESTONES_QUERY = /* GraphQL */ `
  query PrMilestones($owner: String!, $repo: String!, $q: String) {
    repository(owner: $owner, name: $repo) {
      milestones(first: 25, states: OPEN, query: $q, orderBy: { field: DUE_DATE, direction: ASC }) { nodes { id title } }
    }
  }
`;

/** Sets or removes the milestone, from the repo's open milestones. They load once the menu first opens. */
function MilestonePicker({ pr, queryKey }: { pr: PrWithReview; queryKey: QueryKey }) {
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 200);
  const [owner, repo] = repoPath(pr).split('/');
  const milestones = useQuery({
    queryKey: ['pr-milestones', owner, repo, q],
    queryFn: async () =>
      (await gql<{ repository: { milestones: { nodes: { id: string; title: string }[] } } | null }>(MILESTONES_QUERY, { owner, repo, q: q || null })).repository?.milestones
        .nodes ?? [],
    enabled: opened,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const set = usePrMutation(queryKey);
  const current = pr.milestone;
  const options: MenuOption<string>[] = [
    ...(search ? [] : [{ value: '', label: 'No milestone' }]),
    ...(current && !search ? [{ value: current.id, label: current.title }] : []),
    ...(milestones.data ?? []).filter((m) => m.id !== current?.id || search).map((m) => ({ value: m.id, label: m.title })),
  ];
  return (
    <Menu<string>
      value={current?.id ?? ''}
      options={options}
      onChange={(id) => {
        if (id !== (current?.id ?? '')) set.mutate({ query: EDIT_MUTATIONS.updateMilestone, variables: { id: pr.id, milestone: id || null } });
      }}
      header={
        <div className="p-1 pb-1.5">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter milestones"
            className="h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[12.5px] outline-none focus:border-accent/60"
          />
          {options.length === 0 && <p className="px-1.5 pt-2 text-[12px] text-subtle">{milestones.isFetching ? 'Searching…' : 'No open milestones'}</p>}
        </div>
      }
      trigger={(open) => (
        <button
          type="button"
          aria-label="Set milestone"
          title="Set milestone"
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
 * Everyone who took part in the conversation, in order of first appearance: the author, then whoever commented
 * or reviewed. Built from what the page already has, so it costs no request.
 */
export function participantsOf(pr: Pick<PrWithReview, 'author' | 'reviewThreads'>, timeline: { __typename: string; author?: Actor }[]) {
  const people = new Map<string, NonNullable<Actor>>();
  const add = (actor: Actor | undefined) => actor && !people.has(actor.login) && people.set(actor.login, actor);
  add(pr.author);
  for (const item of timeline) if (item.__typename === 'IssueComment' || item.__typename === 'PullRequestReview') add(item.author);
  for (const thread of pr.reviewThreads.nodes) for (const comment of thread.comments.nodes) add(comment.author);
  return [...people.values()];
}

const LOCK_OPTIONS: MenuOption<LockReason | 'NONE'>[] = [
  { value: 'NONE', label: 'Without a reason' },
  { value: 'OFF_TOPIC', label: 'Off-topic' },
  { value: 'TOO_HEATED', label: 'Too heated' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'SPAM', label: 'Spam' },
];

/**
 * Notifications (subscribe or unsubscribe), the participants, and, for people with write access (`canLock`),
 * locking the conversation.
 */
export function NotificationsCard({ pr, participants, canLock, queryKey }: { pr: PrWithReview; participants: NonNullable<Actor>[]; canLock: boolean; queryKey: QueryKey }) {
  const subscribe = usePrMutation(queryKey);
  const lock = usePrMutation(queryKey);
  const subscribed = pr.viewerSubscription === 'SUBSCRIBED';
  return (
    <Card title="Notifications">
      {pr.viewerCanSubscribe && (
        <div className="px-2 pb-2">
          <Button
            size="sm"
            className="w-full justify-center"
            loading={subscribe.isPending}
            icon={<HugeiconsIcon icon={subscribed ? NotificationOff01Icon : Notification01Icon} className="size-3.5" />}
            onClick={() =>
              subscribe.mutate({
                query: EDIT_MUTATIONS.subscribe,
                variables: { id: pr.id, state: subscribed ? 'UNSUBSCRIBED' : 'SUBSCRIBED' },
                success: subscribed ? 'Unsubscribed' : 'Subscribed',
              })
            }
          >
            {subscribed ? 'Unsubscribe' : 'Subscribe'}
          </Button>
          <p className="mt-1.5 text-[11.5px] text-subtle">
            {subscribed
              ? 'You get notifications for this pull request.'
              : pr.viewerSubscription === 'IGNORED'
                ? 'You ignore this repository, so you get no notifications for it.'
                : "You don't get notifications for this pull request."}
          </p>
        </div>
      )}
      {participants.length > 0 && (
        <Field label={`${participants.length} participant${participants.length === 1 ? '' : 's'}`}>
          <div className="flex flex-wrap gap-1 px-2 pt-0.5">
            {participants.map((p) => (
              <a key={p.login} href={`/${p.login}`} title={p.login} aria-label={p.login}>
                <Avatar src={p.avatarUrl} size={22} />
              </a>
            ))}
          </div>
        </Field>
      )}
      {canLock && (
        <div className="mt-1 border-t border-line px-2 pt-2 pb-0.5">
          {pr.locked ? (
            <button
              type="button"
              disabled={lock.isPending}
              onClick={() => lock.mutate({ query: EDIT_MUTATIONS.unlock, variables: { id: pr.id }, success: 'Conversation unlocked' })}
              className="flex h-7 cursor-pointer items-center gap-2 text-[12.5px] text-muted hover:text-fg"
            >
              <HugeiconsIcon icon={SquareUnlock01Icon} className="size-3.5" /> Unlock conversation
            </button>
          ) : (
            <Menu<LockReason | 'NONE'>
              align="left"
              value={null}
              options={LOCK_OPTIONS}
              onChange={(reason) =>
                lock.mutate({ query: EDIT_MUTATIONS.lock, variables: { id: pr.id, reason: reason === 'NONE' ? null : reason }, success: 'Conversation locked' })
              }
              trigger={(open) => (
                <button type="button" disabled={lock.isPending} onClick={open} className="flex h-7 cursor-pointer items-center gap-2 text-[12.5px] text-muted hover:text-fg">
                  <HugeiconsIcon icon={SquareLock01Icon} className="size-3.5" /> Lock conversation
                </button>
              )}
            />
          )}
        </div>
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
  query PrPickerCandidates($owner: String!, $repo: String!, $q: String!, $labels: Boolean!, $teams: Boolean!) {
    repository(owner: $owner, name: $repo) {
      assignableUsers(first: 20, query: $q) @skip(if: $labels) { nodes { id login name } }
      labels(first: 30, query: $q) @include(if: $labels) { nodes { id name description } }
    }
    # A team can review once it has access to the repository: each team's repositories are searched for it.
    repositoryOwner(login: $owner) @include(if: $teams) {
      ... on Organization { teams(first: 20, query: $q) { nodes { id name combinedSlug repositories(first: 5, query: $repo) { nodes { name } } } } }
    }
  }
`;

type Candidates = {
  repository: {
    assignableUsers?: { nodes: { id: string; login: string; name: string | null }[] };
    labels?: { nodes: { id: string; name: string; description: string | null }[] };
  } | null;
  repositoryOwner?: { teams?: { nodes: { id: string; name: string; combinedSlug: string; repositories: { nodes: { name: string }[] } }[] } } | null;
};

/** A picker's option; `team` marks a team among the reviewers. */
type Candidate = MenuOption<string> & { team?: boolean };

/**
 * What the picker lists: the current selection first (unless searching, when only matches show), then the
 * candidates, each once, minus any whose label is in `hide`.
 */
export function pickerOptions(selected: MenuOption<string>[], candidates: MenuOption<string>[], search: string, hide: (string | null | undefined)[]) {
  return [...(search ? [] : selected), ...candidates].filter((option, i, all) => !hide.includes(option.label) && all.findIndex((o) => o.value === option.value) === i);
}

/**
 * Searchable multi-select over the repo's assignable users, labels, or reviewers: assignable users and the
 * organization's teams with access to the repo (option values are node ids). A pick applies at once, `add` or
 * (if it was selected) `remove`, and shows as done while the PR refetches. Options whose label is in `hide`
 * aren't offered.
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
  kind: 'users' | 'labels' | 'reviewers';
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
      const { repository, repositoryOwner } = await gql<Candidates>(CANDIDATES_QUERY, { owner, repo, q, labels: kind === 'labels', teams: kind === 'reviewers' });
      const teams = (repositoryOwner?.teams?.nodes ?? []).filter((t) => t.repositories.nodes.some((r) => r.name.toLowerCase() === repo?.toLowerCase()));
      return [
        ...(repository?.assignableUsers?.nodes ?? []).map((u): Candidate => ({ value: u.id, label: u.login, hint: u.name ?? undefined })),
        ...teams.map((t): Candidate => ({ value: t.id, label: t.name, hint: `@${t.combinedSlug}`, team: true })),
        ...(repository?.labels?.nodes ?? []).map((l): Candidate => ({ value: l.id, label: l.name, hint: l.description ?? undefined })),
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
      .mutateAsync({ query, variables: candidates.data?.find((o) => o.value === id)?.team ? { id: pr.id, teams: [id] } : { id: pr.id, ids: [id] } })
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
            placeholder={kind === 'labels' ? 'Filter labels' : kind === 'reviewers' ? 'Search people and teams' : 'Search people'}
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
    <Card title="Files" count={pr.changedFiles}>
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
