import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Panel, Skeleton } from '@/ui/primitives';
import { OutcomeIcon } from '@/pages/pr/ChecksTab';
import { ansiSpans, splitLog, type LineKind, type LogLine } from './log';
import { elapsed, jobLogQuery, jobQuery, outcome, type Job } from './query';

/**
 * One job: its steps with status and duration, each opening onto its part of the log. Failed steps start
 * open, scrolled to their first error. A running job has no log yet (GitHub only streams it to its own page).
 */
export function JobView({ owner, repo, jobId }: { owner: string; repo: string; jobId: number }) {
  const { data: job, error } = useQuery(jobQuery(owner, repo, jobId));
  if (error) return <p className="text-[13px] text-danger">{error.message}</p>;
  if (!job) return <Skeleton className="h-96 rounded-xl" />;
  return (
    <Panel>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <OutcomeIcon outcome={outcome(job)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{job.name}</div>
          <div className="truncate text-[12px] text-muted">
            {job.started_at ? `${job.status === 'completed' ? 'Took' : 'Running for'} ${elapsed(job.started_at, job.completed_at)}` : 'Queued'}
            {job.runner_name && ` · ${job.runner_name}`}
          </div>
        </div>
      </div>
      {/* Keyed by job: a step list's open steps and scroll belong to one job. */}
      <Steps key={job.id} owner={owner} repo={repo} job={job} />
    </Panel>
  );
}

function Steps({ owner, repo, job }: { owner: string; repo: string; job: Job }) {
  const steps = job.steps ?? [];
  const done = job.status === 'completed';
  const log = useQuery({ ...jobLogQuery(owner, repo, job.id), enabled: done });
  const split = useMemo(() => (log.data && job.steps ? splitLog(log.data, job.steps) : undefined), [log.data, job.steps]);
  const [open, setOpen] = useState(() => new Set(steps.filter((s) => s.conclusion === 'failure').map((s) => s.number)));

  // Where the job failed: the failed step's first error line, else its last line.
  const failed = steps.find((step) => step.conclusion === 'failure');
  const failedLines = failed && split?.get(failed.number);
  const target = failedLines && (failedLines.find((line) => line.kind === 'error') ?? failedLines.at(-1));
  const targetRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (!targetRef.current || scrolled.current) return;
    scrolled.current = true;
    targetRef.current.scrollIntoView({ block: 'center' });
  }, [target]);

  return (
    <div className="flex flex-col p-1.5">
      {!done && (
        <div className="mx-1 mt-1 mb-2 flex items-center gap-3 rounded-lg bg-elevated px-3.5 py-2.5 text-[12.5px] text-muted">
          <span className="flex-1">{job.status === 'in_progress' ? 'Logs are ready here when the job finishes.' : 'This job hasn’t started yet.'}</span>
          {job.status === 'in_progress' && (
            <Button size="sm" icon={<HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5" />} onClick={openClassic}>
              Live log on GitHub
            </Button>
          )}
        </div>
      )}
      {done && log.data === null && <p className="px-3.5 py-2.5 text-[12.5px] text-subtle">GitHub has no log for this job. Logs expire after the repository’s retention period (90 days by default).</p>}
      {log.error && <p className="px-3.5 py-2.5 text-[12.5px] text-danger">{log.error.message}</p>}
      {steps.map((step) => {
        const lines = split?.get(step.number);
        const expandable = done && step.conclusion !== 'skipped' && log.data !== null;
        const isOpen = expandable && open.has(step.number);
        const result = outcome(step);
        return (
          <div key={step.number}>
            <button
              type="button"
              data-row
              disabled={!expandable}
              onClick={() => setOpen((current) => toggled(current, step.number))}
              className={cx(
                'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left focus:outline-none',
                expandable ? 'cursor-pointer hover:bg-hover focus:bg-hover' : 'cursor-default',
                isOpen && 'sticky top-[93px] z-10 bg-panel',
              )}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className={cx('size-3.5 shrink-0 text-subtle transition-transform', isOpen && 'rotate-90', !expandable && 'invisible')} />
              <OutcomeIcon outcome={result} />
              <span className={cx('min-w-0 flex-1 truncate text-[12.5px]', result === 'FAILURE' ? 'font-medium text-fg' : step.conclusion === 'skipped' ? 'text-subtle' : 'text-fg/85')}>{step.name}</span>
              <span className="text-right text-[11.5px] text-subtle tabular-nums">{step.started_at && step.conclusion !== 'skipped' ? elapsed(step.started_at, step.completed_at) : ''}</span>
            </button>
            {isOpen &&
              (lines ? (
                <LogView lines={lines} target={step === failed ? target : undefined} targetRef={targetRef} />
              ) : (
                <Skeleton className="mx-2.5 my-1.5 h-24 rounded-lg" />
              ))}
          </div>
        );
      })}
    </div>
  );
}

/** A copy of `set` with `value` added, or removed if it was there. */
function toggled<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

// A step's log past this many lines shows its end (where failures are) until asked for the rest.
const TAIL = 3000;

const KIND_STYLE: Partial<Record<LineKind, { row: string; label?: string }>> = {
  error: { row: 'bg-danger/10 text-danger', label: 'Error: ' },
  warning: { row: 'bg-warning/10 text-warning', label: 'Warning: ' },
  notice: { row: 'bg-info/10 text-info', label: 'Notice: ' },
  debug: { row: 'text-merged', label: 'Debug: ' },
  command: { row: 'text-info' },
};

/** A step's log lines with their numbers and ANSI colors; `##[group]`s fold, closed unless they hold the target. */
function LogView({ lines, target, targetRef }: { lines: LogLine[]; target?: LogLine; targetRef: Ref<HTMLDivElement> }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(lines.filter((l) => l.kind === 'error' || l === target).map((l) => l.group)));
  const [all, setAll] = useState(false);
  const from = all ? 0 : Math.max(0, Math.min(lines.length - TAIL, target ? lines.indexOf(target) : Infinity));
  const shown = lines.slice(from);

  if (!lines.length) return <p className="px-10 pt-1 pb-3 text-[12px] text-subtle">No output.</p>;

  return (
    <div className="mx-1.5 mb-1.5 overflow-x-auto rounded-lg border border-line bg-bg py-1.5 font-mono text-[12px] leading-5 [--log-cyan:#0e7f8f] dark:[--log-cyan:#5cc7d6]">
      {from > 0 && (
        <button type="button" onClick={() => setAll(true)} className="mb-1 ml-14 cursor-pointer font-sans text-[12px] text-accent hover:underline">
          Show {from.toLocaleString()} earlier lines
        </button>
      )}
      {shown.map((line) => {
        if (line.group !== undefined && !openGroups.has(line.group)) return null;
        const style = line.kind && KIND_STYLE[line.kind];
        const isGroup = line.kind === 'group';
        const groupOpen = isGroup && openGroups.has(line.number);
        return (
          <div
            key={line.number}
            ref={line === target ? targetRef : undefined}
            onClick={isGroup ? () => setOpenGroups((current) => toggled(current, line.number)) : undefined}
            className={cx('flex min-w-0', style?.row, isGroup ? 'cursor-pointer hover:bg-hover' : !style && 'hover:bg-hover')}
          >
            <span className="w-14 shrink-0 pr-3 text-right text-subtle tabular-nums select-none">{line.number}</span>
            {isGroup && <HugeiconsIcon icon={ArrowRight01Icon} className={cx('mt-[3px] mr-1 size-3.5 shrink-0 text-subtle transition-transform', groupOpen && 'rotate-90')} />}
            <span className={cx('min-w-0 flex-1 pr-4 break-all whitespace-pre-wrap', isGroup && 'font-medium text-fg')}>
              {style?.label && <span className="font-semibold">{style.label}</span>}
              {ansiSpans(line.text).map((span, i) => (
                <span
                  key={i}
                  style={{
                    color: span.fg,
                    background: span.bg,
                    fontWeight: span.bold ? 600 : undefined,
                    opacity: span.dim ? 0.7 : undefined,
                    fontStyle: span.italic ? 'italic' : undefined,
                    textDecoration: span.underline ? 'underline' : undefined,
                  }}
                >
                  {span.text}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
