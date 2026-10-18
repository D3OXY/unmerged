import { useEffect, useRef, type PointerEvent } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Loading03Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { slideToMergeItem, useStorageItem } from '@/lib/settings';
import { toastsLifted } from '@/ui/toast';
import { canMergeNow, defaultCommitMessage, defaultMergeMethod } from './merge';
import { MUTATIONS, type MergeMethod, type PullRequest, type Repo } from './query';
import { usePrMutation } from './usePrMutation';

const LABEL: Record<MergeMethod, string> = {
  SQUASH: 'Slide to squash and merge',
  MERGE: 'Slide to merge',
  REBASE: 'Slide to rebase and merge',
};

// Track 248×48 with a 4px inset around the 40px grip, so the grip travels 200px.
const TRAVEL = 200;
/** Released past this share of the travel, the grip finishes the slide itself. */
const CONFIRM_AT = 0.9;

/**
 * A floating glass slider in the bottom-right corner that merges the PR with the viewer's default method. It
 * shows on every PR tab while the PR can merge in one step (see `canMergeNow`) and the setting is on.
 */
export function SlideToMerge({ pr, repo, queryKey }: { pr: PullRequest; repo: Repo; queryKey: QueryKey }) {
  const on = useStorageItem(slideToMergeItem);
  if (!on || !canMergeNow(pr, repo)) return null;
  return <Slider pr={pr} repo={repo} queryKey={queryKey} />;
}

function Slider({ pr, repo, queryKey }: { pr: PullRequest; repo: Repo; queryKey: QueryKey }) {
  const method = defaultMergeMethod(repo);
  const merge = usePrMutation(queryKey);
  const busy = merge.isPending || merge.isSuccess;
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; p: number } | null>(null);

  useEffect(() => {
    toastsLifted.set(true);
    return () => toastsLifted.set(false);
  }, []);

  // The slide writes `--p` (0 to 1) and `data-held` straight to the track, so a drag doesn't render React.
  // Setting both in one handler lets the release animate: the transition comes back with the new position.
  const settle = (p: number) => {
    track.current?.removeAttribute('data-held');
    track.current?.style.setProperty('--p', String(p));
  };

  const confirm = () => {
    settle(1);
    merge.mutate(
      {
        query: MUTATIONS.merge,
        variables: { id: pr.id, method, oid: pr.headRefOid, ...defaultCommitMessage(pr, method) },
        success: `Merged #${pr.number}`,
        nextAfter: pr.url,
      },
      { onError: () => settle(0) },
    );
  };

  const release = (e: PointerEvent, commit: boolean) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    drag.current = null;
    if (commit && d.p >= CONFIRM_AT) confirm();
    else settle(0);
  };

  return (
    <div
      ref={track}
      className="group fixed right-4 bottom-4 z-40 h-12 w-[248px] animate-pop rounded-full border border-line-strong bg-panel/55 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35),inset_0_1px_0_rgb(255_255_255/0.22)] backdrop-blur-xl backdrop-saturate-[1.8] select-none dark:border-white/12"
    >
      {/* The glass's sheen: light from above. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-linear-to-b from-white/20 via-white/[0.04] to-transparent" />
      <span aria-hidden className="absolute inset-1 overflow-hidden rounded-full">
        <span
          className="block size-full rounded-full bg-success transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-data-held:transition-none"
          style={{ transform: `translateX(calc((var(--p, 0) - 1) * ${TRAVEL}px))` }}
        />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 left-11 grid place-items-center text-[13px] font-medium whitespace-nowrap text-fg/75 transition-opacity duration-200 group-data-held:transition-none"
        style={{ opacity: 'calc(1 - var(--p, 0) * 2)' }}
      >
        {LABEL[method]}
      </span>
      <span role="status" className="pointer-events-none absolute inset-y-0 right-11 left-3 grid place-items-center text-[13px] font-medium text-white">
        {busy && <span className="animate-pop">{merge.isSuccess ? 'Merged' : 'Merging…'}</span>}
      </span>
      <button
        type="button"
        aria-label={LABEL[method]}
        aria-disabled={busy}
        className="absolute top-1 left-1 flex size-10 cursor-grab touch-none items-center justify-center rounded-full bg-success text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_1px_4px_rgb(0_0_0/0.3)] transition-[transform,filter] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] outline-none group-data-held:cursor-grabbing group-data-held:transition-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-default"
        style={{ transform: `translateX(calc(var(--p, 0) * ${TRAVEL}px))` }}
        onPointerDown={(e) => {
          if (busy || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { id: e.pointerId, x: e.clientX, p: 0 };
          track.current?.setAttribute('data-held', '');
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d?.id !== e.pointerId) return;
          d.p = Math.min(1, Math.max(0, (e.clientX - d.x) / TRAVEL));
          track.current?.style.setProperty('--p', String(d.p));
        }}
        onPointerUp={(e) => release(e, true)}
        onPointerCancel={(e) => release(e, false)}
        // From the keyboard, focusing the grip and pressing Enter or Space is the deliberate act.
        onKeyDown={(e) => {
          if (busy || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          confirm();
        }}
      >
        <HugeiconsIcon
          icon={merge.isSuccess ? Tick02Icon : merge.isPending ? Loading03Icon : ArrowRight01Icon}
          className={merge.isPending ? 'size-4.5 animate-spin' : 'size-4.5'}
          strokeWidth={2.2}
        />
      </button>
    </div>
  );
}
