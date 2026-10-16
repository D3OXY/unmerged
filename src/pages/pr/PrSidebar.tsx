import { useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Cancel01Icon, Clock01Icon, Comment01Icon, MinusSignIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { diffAnchor } from './files/anchor';
import { statusDot } from './files/status';
import { Avatar, Panel, Pill } from '@/ui/primitives';
import { CheckIcon } from '@/ui/status';
import { checkName, checkUrl, outcomeOf, type CheckOutcome } from './checks';
import type { CheckContext, PullRequest, ReviewState } from './query';

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

export function PeopleCard({ pr }: { pr: PullRequest }) {
  const reviewed = pr.latestOpinionatedReviews.nodes.filter((r) => r.author);
  const requested = pr.reviewRequests.nodes.flatMap(({ requestedReviewer: r }) =>
    r && r.__typename !== 'Mannequin' ? [{ name: 'login' in r ? r.login : r.name, avatarUrl: r.avatarUrl }] : [],
  );

  return (
    <Card title="People">
      <Field label="Reviewers">
        {reviewed.length + requested.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
        {reviewed.map((r) => (
          <Person key={r.author!.login} name={r.author!.login} avatarUrl={r.author!.avatarUrl} trailing={REVIEW_ICON[r.state]} />
        ))}
        {requested.map((r) => (
          <Person key={r.name} name={r.name} avatarUrl={r.avatarUrl} trailing={<HugeiconsIcon icon={Clock01Icon} className="size-3.5 text-warning" />} />
        ))}
      </Field>
      <Field label="Assignees">
        {pr.assignees.nodes.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
        {pr.assignees.nodes.map((a) => (
          <Person key={a.login} name={a.login} avatarUrl={a.avatarUrl} />
        ))}
      </Field>
      {pr.labels.nodes.length > 0 && (
        <Field label="Labels">
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

async function openFile(prUrl: string, path: string) {
  navigate(`${prUrl}/files#${await diffAnchor(path)}`);
}

export function FilesCard({ pr }: { pr: PullRequest }) {
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

export function Card({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <Panel className="p-2">
      <div className="flex h-7 items-center gap-1.5 px-2 text-[12px] font-medium text-muted">
        {title}
        {count !== undefined && <span className="font-normal text-subtle tabular-nums">{count}</span>}
      </div>
      {children}
    </Panel>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-2 pb-0.5 text-[11px] text-subtle">{label}</div>
      {children}
    </div>
  );
}

export function Person({ name, avatarUrl, trailing }: { name: string; avatarUrl: string | null; trailing?: ReactNode }) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px]">
      <Avatar src={avatarUrl} size={18} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {trailing}
    </div>
  );
}
