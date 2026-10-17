import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChecksCard } from '@/pages/pr/PrSidebar';
import { checkCounts, type CommitRowData } from '@/ui/CommitList';
import { Skeleton } from '@/ui/primitives';
import { CheckIcon } from '@/ui/status';
import { useDismiss } from '@/ui/useDismiss';
import { commitChecksQuery } from './query';

type Props = { owner: string; repo: string; oid: string; rollup: NonNullable<CommitRowData['statusCheckRollup']> };

/** "3 / 4 checks", opening the commit's checks (failures first), each linking to its job's logs. */
export function CommitChecks({ owner, repo, oid, rollup }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss([ref], open, useCallback(() => setOpen(false), []));
  const { data } = useQuery({ ...commitChecksQuery(owner, repo, oid), enabled: open });
  const { passed, total } = checkCounts(rollup);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={`${passed} of ${total} checks passed`}
        className="flex cursor-pointer items-center gap-1 tabular-nums hover:text-fg"
      >
        <CheckIcon state={rollup.state} className="size-3" />
        {passed} / {total} checks
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-80 animate-pop rounded-xl shadow-2xl shadow-black/30">
          {data ? <ChecksCard checks={data} /> : <Skeleton className="h-24 rounded-xl" />}
        </div>
      )}
    </div>
  );
}
