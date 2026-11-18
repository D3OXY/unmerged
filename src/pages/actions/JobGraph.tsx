import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import { OutcomeIcon } from '@/pages/pr/ChecksTab';
import { Panel } from '@/ui/primitives';
import type { GraphNode } from './graph';
import { elapsed, outcome, type Job } from './query';

/**
 * A run's jobs as a graph (see runGraph), top to bottom. The browser places the cards, so a wide level wraps;
 * the lines are then drawn between where the cards are, and again when any card changes size.
 */
export function JobGraph({ levels, base }: { levels: GraphNode[][]; base: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState('');

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const cards = [...element.querySelectorAll<HTMLElement>('[data-node]')];
    const draw = () => {
      const origin = element.getBoundingClientRect();
      const rects = new Map(cards.map((card) => [card.dataset.node, card.getBoundingClientRect()]));
      const paths = levels.flat().flatMap((node) => {
        const to = rects.get(node.id);
        return node.needs.flatMap((need) => {
          const from = rects.get(need);
          if (!from || !to) return [];
          const x1 = from.left + from.width / 2 - origin.left;
          const y1 = from.bottom - origin.top;
          const x2 = to.left + to.width / 2 - origin.left;
          const y2 = to.top - origin.top;
          const bend = Math.min(48, (y2 - y1) / 2);
          return `M${x1} ${y1}C${x1} ${y1 + bend} ${x2} ${y2 - bend} ${x2} ${y2}`;
        });
      });
      setLines(paths.join(''));
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [levels]);

  return (
    <Panel className="overflow-x-auto p-6">
      <div ref={box} className="relative flex flex-col items-center gap-12">
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <path d={lines} fill="none" strokeWidth={1.25} className="stroke-line-strong" />
        </svg>
        {levels.map((level, i) => (
          <div key={i} className="flex max-w-full flex-wrap items-start justify-center gap-3">
            {level.map((node) => (
              <Card key={node.id} node={node} base={base} />
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Card({ node, base }: { node: GraphNode; base: string }) {
  return (
    <div data-node={node.id} className="relative w-60 rounded-lg border border-line bg-elevated">
      {node.title && <div className="truncate px-3 pt-2 text-[11px] text-subtle">{node.title}</div>}
      <div className="max-h-80 overflow-y-auto p-1">
        {node.jobs.map(({ job, label }) => (
          <JobRow key={job.id} job={job} label={label} base={base} className="min-h-8 gap-2 rounded-md px-2 py-1" />
        ))}
      </div>
    </div>
  );
}

/** A job's link to its logs: its status, `label`, the step it failed at, and its time. `className` sizes it. */
export function JobRow({ job, label, base, className }: { job: Job; label: string; base: string; className: string }) {
  const result = outcome(job);
  const step = result === 'FAILURE' && job.steps?.find((s) => s.conclusion === 'failure')?.name;
  const time = job.conclusion === 'skipped' ? 'Skipped' : job.started_at ? elapsed(job.started_at, job.completed_at) : '';
  return (
    <a href={`${base}/job/${job.id}`} data-row title={label} className={cx('flex items-center hover:bg-hover focus:bg-hover focus:outline-none', className)}>
      <OutcomeIcon outcome={result} />
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[12.5px]', result === 'FAILURE' ? 'font-medium text-fg' : 'text-fg/85')}>{label}</span>
        {step && <span className="block truncate text-[11.5px] text-subtle">Failed at {step}</span>}
      </span>
      <span className="text-[11.5px] text-subtle tabular-nums">{time}</span>
    </a>
  );
}
