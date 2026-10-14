import { useMemo, useState, type ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronDown, CircleDashed, GitBranch, GitMerge, Loader2, ShieldAlert, X } from 'lucide-react';
import { useRegisterCommands } from '@/app/commands';
import { cx } from '@/lib/cx';
import { timeAgo } from '@/lib/time';
import { Button } from '@/ui/Button';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Panel } from '@/ui/primitives';
import { summarizeChecks } from './checks';
import { MUTATIONS, type MergeMethod, type PullRequest, type Repo } from './query';
import { usePrMutation } from './usePrMutation';

const METHOD_LABEL: Record<MergeMethod, string> = {
  SQUASH: 'Squash and merge',
  MERGE: 'Create a merge commit',
  REBASE: 'Rebase and merge',
};

const METHOD_HINT: Record<MergeMethod, string> = {
  SQUASH: 'Combine all commits into one on the base branch',
  MERGE: 'Keep every commit and add a merge commit',
  REBASE: 'Replay commits onto the base branch',
};

/** Always-visible merge panel: requirements as a checklist, one obvious primary action. */
export function MergeBox({ repo, pr, queryKey }: { repo: Repo; pr: PullRequest; queryKey: QueryKey }) {
  if (pr.state === 'MERGED') return <MergedBox pr={pr} queryKey={queryKey} />;
  if (pr.state === 'CLOSED') return <ClosedBox pr={pr} queryKey={queryKey} />;
  return <OpenBox repo={repo} pr={pr} queryKey={queryKey} />;
}

function MergedBox({ pr, queryKey }: { pr: PullRequest; queryKey: QueryKey }) {
  const deleteBranch = usePrMutation(queryKey);
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-3 bg-merged/8 px-4 py-3.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-merged/15 text-merged">
          <GitMerge className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">Merged</div>
          <div className="truncate text-[12px] text-muted">
            {pr.mergedBy?.login} into <code className="font-mono">{pr.baseRefName}</code> · {pr.mergedAt && timeAgo(pr.mergedAt)}
          </div>
        </div>
      </div>
      {pr.headRef && !pr.isCrossRepository && pr.viewerCanUpdate && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <span className="truncate font-mono text-[12px] text-muted">{pr.headRefName}</span>
          <Button
            size="sm"
            variant="danger"
            loading={deleteBranch.isPending}
            onClick={() => deleteBranch.mutate({ query: MUTATIONS.deleteBranch, variables: { id: pr.headRef!.id }, success: 'Branch deleted' })}
          >
            Delete branch
          </Button>
        </div>
      )}
    </Panel>
  );
}

function ClosedBox({ pr, queryKey }: { pr: PullRequest; queryKey: QueryKey }) {
  const reopen = usePrMutation(queryKey);
  return (
    <Panel className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-danger/12 text-danger">
        <X className="size-4" />
      </span>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">Closed</div>
        <div className="text-[12px] text-muted">{pr.closedAt && `Closed ${timeAgo(pr.closedAt)}`}</div>
      </div>
      {pr.viewerCanUpdate && (
        <Button size="sm" loading={reopen.isPending} onClick={() => reopen.mutate({ query: MUTATIONS.reopen, variables: { id: pr.id }, success: 'Reopened' })}>
          Reopen
        </Button>
      )}
    </Panel>
  );
}

type Tone = 'ok' | 'fail' | 'wait' | 'neutral';

function OpenBox({ repo, pr, queryKey }: { repo: Repo; pr: PullRequest; queryKey: QueryKey }) {
  const methods = useMemo(
    () =>
      (['SQUASH', 'MERGE', 'REBASE'] as const).filter((m) =>
        m === 'SQUASH' ? repo.squashMergeAllowed : m === 'MERGE' ? repo.mergeCommitAllowed : repo.rebaseMergeAllowed,
      ),
    [repo],
  );
  const [method, setMethod] = useState<MergeMethod>(methods.includes(repo.viewerDefaultMergeMethod) ? repo.viewerDefaultMergeMethod : (methods[0] ?? 'MERGE'));
  const [confirming, setConfirming] = useState(false);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');

  const merge = usePrMutation(queryKey);
  const secondary = usePrMutation(queryKey);

  const startConfirm = (m: MergeMethod = method) => {
    setHeadline(m === 'SQUASH' ? pr.squashHeadline : m === 'MERGE' ? pr.mergeHeadline : '');
    setBody(m === 'SQUASH' ? pr.squashBody : m === 'MERGE' ? pr.mergeBody : '');
    setConfirming(true);
  };

  const commitFields = method === 'REBASE' ? {} : { headline, body };
  const doMerge = () =>
    merge.mutate({
      query: MUTATIONS.merge,
      variables: { id: pr.id, method, oid: pr.headRefOid, ...commitFields },
      success: `Merged #${pr.number}`,
    });

  const ready = pr.mergeStateStatus === 'CLEAN' || pr.mergeStateStatus === 'HAS_HOOKS' || pr.mergeStateStatus === 'UNSTABLE';
  const canAutoMerge = repo.autoMergeAllowed && pr.viewerCanEnableAutoMerge;

  useRegisterCommands(
    'merge-box',
    useMemo(
      () =>
        ready && !pr.isDraft && !pr.isMergeQueueEnabled
          ? [{ id: 'pr:merge', group: 'Pull request', title: `${METHOD_LABEL[method]}…`, icon: <GitMerge />, perform: () => startConfirm() }]
          : [],
      [ready, pr, method],
    ),
  );

  const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup;
  const counts = summarizeChecks(rollup?.contexts.nodes ?? []);
  const totalChecks = counts.SUCCESS + counts.FAILURE + counts.PENDING + counts.NEUTRAL;

  if (pr.isDraft) {
    return (
      <Panel className="p-4">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          <CircleDashed className="size-4 text-subtle" /> Draft
        </div>
        <p className="mt-1 text-[12.5px] text-muted">This pull request can't be merged until it's ready for review.</p>
        {pr.viewerCanUpdate && (
          <Button
            className="mt-3 w-full justify-center"
            variant="primary"
            loading={secondary.isPending}
            onClick={() => secondary.mutate({ query: MUTATIONS.readyForReview, variables: { id: pr.id }, success: 'Ready for review' })}
          >
            Ready for review
          </Button>
        )}
      </Panel>
    );
  }

  const requirements: { tone: Tone; label: string; detail?: string; action?: ReactNode }[] = [
    pr.reviewDecision === 'APPROVED'
      ? { tone: 'ok', label: 'Approved' }
      : pr.reviewDecision === 'CHANGES_REQUESTED'
        ? { tone: 'fail', label: 'Changes requested' }
        : pr.reviewDecision === 'REVIEW_REQUIRED'
          ? { tone: 'wait', label: 'Review required' }
          : { tone: 'neutral', label: 'No review required' },
    totalChecks === 0
      ? { tone: 'neutral', label: 'No checks' }
      : counts.FAILURE
        ? { tone: 'fail', label: `${counts.FAILURE} failing check${counts.FAILURE > 1 ? 's' : ''}`, detail: `${counts.SUCCESS} passed` }
        : counts.PENDING
          ? { tone: 'wait', label: `${counts.PENDING} check${counts.PENDING > 1 ? 's' : ''} running`, detail: `${counts.SUCCESS} passed` }
          : { tone: 'ok', label: 'All checks passed', detail: `${counts.SUCCESS}` },
    pr.mergeable === 'CONFLICTING'
      ? {
          tone: 'fail',
          label: 'Conflicts with base',
          action: (
            <a href={`${pr.url}/conflicts`} className="text-[12px] text-accent hover:underline">
              Resolve
            </a>
          ),
        }
      : pr.mergeable === 'UNKNOWN'
        ? { tone: 'wait', label: 'Checking for conflicts…' }
        : { tone: 'ok', label: 'No conflicts' },
  ];
  if (pr.mergeStateStatus === 'BEHIND') {
    requirements.push({
      tone: 'wait',
      label: 'Behind base branch',
      action: pr.viewerCanUpdateBranch && (
        <Button
          size="sm"
          loading={secondary.isPending}
          onClick={() => secondary.mutate({ query: MUTATIONS.updateBranch, variables: { id: pr.id }, success: 'Branch updated' })}
        >
          Update
        </Button>
      ),
    });
  }

  const methodMenu = methods.length > 1 && (
    <Menu<MergeMethod>
      value={method}
      options={methods.map((m): MenuOption<MergeMethod> => ({ value: m, label: METHOD_LABEL[m], hint: METHOD_HINT[m] }))}
      onChange={(m) => {
        setMethod(m);
        if (confirming) startConfirm(m);
      }}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          aria-label="Choose merge method"
          className="flex h-8 cursor-pointer items-center rounded-r-lg border-l border-black/20 bg-success px-2 text-white hover:brightness-110"
        >
          <ChevronDown className="size-3.5" />
        </button>
      )}
    />
  );

  let action: ReactNode;
  if (pr.isInMergeQueue) {
    action = (
      <Row icon={<Loader2 className="size-4 animate-spin text-merged" />} title="Queued to merge" detail={pr.mergeQueueEntry ? `Position ${pr.mergeQueueEntry.position}` : undefined}>
        <Button size="sm" loading={secondary.isPending} onClick={() => secondary.mutate({ query: MUTATIONS.dequeue, variables: { id: pr.id }, success: 'Removed from queue' })}>
          Remove
        </Button>
      </Row>
    );
  } else if (pr.autoMergeRequest) {
    action = (
      <Row
        icon={<GitMerge className="size-4 text-success" />}
        title="Auto-merge enabled"
        detail={`${METHOD_LABEL[pr.autoMergeRequest.mergeMethod]} · by ${pr.autoMergeRequest.enabledBy?.login ?? 'someone'}`}
      >
        {pr.viewerCanDisableAutoMerge && (
          <Button size="sm" loading={secondary.isPending} onClick={() => secondary.mutate({ query: MUTATIONS.disableAutoMerge, variables: { id: pr.id }, success: 'Auto-merge disabled' })}>
            Disable
          </Button>
        )}
      </Row>
    );
  } else if (pr.isMergeQueueEnabled) {
    action = (
      <Button
        variant="success"
        className="w-full justify-center"
        disabled={pr.mergeable === 'CONFLICTING'}
        loading={merge.isPending}
        onClick={() => merge.mutate({ query: MUTATIONS.enqueue, variables: { id: pr.id, oid: pr.headRefOid }, success: 'Added to merge queue' })}
      >
        Merge when ready
      </Button>
    );
  } else if (confirming) {
    action = (
      <div className="flex animate-enter flex-col gap-2">
        {method !== 'REBASE' && (
          <>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="h-8 rounded-lg border border-line bg-bg px-2.5 text-[12.5px] font-medium outline-none focus:border-accent/60"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="resize-y rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-[11.5px] leading-relaxed outline-none focus:border-accent/60"
            />
          </>
        )}
        <div className="flex gap-2">
          <Button variant="success" className="flex-1 justify-center" loading={merge.isPending} onClick={doMerge} autoFocus>
            Confirm {METHOD_LABEL[method].toLowerCase()}
          </Button>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      </div>
    );
  } else if (ready) {
    action = (
      <div className="flex">
        <Button variant="success" className={cx('flex-1 justify-center', methodMenu && 'rounded-r-none')} onClick={() => startConfirm()}>
          {METHOD_LABEL[method]}
        </Button>
        {methodMenu}
      </div>
    );
  } else {
    action = (
      <div className="flex flex-col gap-2">
        {canAutoMerge && (
          <Button
            variant="primary"
            className="w-full justify-center"
            loading={merge.isPending}
            onClick={() =>
              merge.mutate({
                query: MUTATIONS.enableAutoMerge,
                variables: { id: pr.id, method, ...(method === 'SQUASH' ? { headline: pr.squashHeadline, body: pr.squashBody } : {}) },
                success: 'Auto-merge enabled',
              })
            }
          >
            Enable auto-merge ({METHOD_LABEL[method].split(' ')[0]!.toLowerCase()})
          </Button>
        )}
        {pr.viewerCanMergeAsAdmin && pr.mergeable !== 'CONFLICTING' ? (
          <Button variant="danger" className="w-full justify-center" icon={<ShieldAlert className="size-3.5" />} onClick={() => startConfirm()}>
            Bypass rules and merge
          </Button>
        ) : (
          !canAutoMerge && (
            <div className="flex items-center gap-2 rounded-lg bg-hover px-3 py-2 text-[12.5px] text-muted">
              <AlertTriangle className="size-3.5 text-warning" />
              {pr.mergeable === 'CONFLICTING' ? 'Resolve conflicts to merge' : 'Merging is blocked'}
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-0.5 p-2">
        {requirements.map((r) => (
          <div key={r.label} className="flex h-8 items-center gap-2.5 rounded-md px-2">
            <ToneIcon tone={r.tone} />
            <span className={cx('text-[12.5px]', r.tone === 'fail' ? 'font-medium text-fg' : 'text-fg/90')}>{r.label}</span>
            {r.detail && <span className="text-[12px] text-subtle">{r.detail}</span>}
            <span className="ml-auto">{r.action}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">{action}</div>
      <div className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11.5px] text-subtle">
        <GitBranch className="size-3" />
        <span className="truncate font-mono">{pr.headRefName}</span>
        <span>→</span>
        <span className="truncate font-mono">{pr.baseRefName}</span>
      </div>
    </Panel>
  );
}

function Row({ icon, title, detail, children }: { icon: ReactNode; title: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{title}</div>
        {detail && <div className="truncate text-[12px] text-muted">{detail}</div>}
      </div>
      {children}
    </div>
  );
}

function ToneIcon({ tone }: { tone: Tone }) {
  const base = 'flex size-4 shrink-0 items-center justify-center rounded-full';
  if (tone === 'ok') return <span className={cx(base, 'bg-success text-white')}><Check className="size-2.5" strokeWidth={3.5} /></span>;
  if (tone === 'fail') return <span className={cx(base, 'bg-danger text-white')}><X className="size-2.5" strokeWidth={3.5} /></span>;
  if (tone === 'wait') return <span className={cx(base, 'border-2 border-warning border-t-transparent animate-spin')} />;
  return <span className={cx(base, 'border border-line-strong')} />;
}

