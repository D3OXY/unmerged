import { useEffect, useRef, type PointerEvent } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowRight02Icon, GitMergeIcon, Loading03Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { slideToMergeItem, useStorageItem } from '@/lib/settings';
import { Menu } from '@/ui/Menu';
import { toastsLifted } from '@/ui/toast';
import { canMergeNow, defaultCommitMessage, METHOD_HINT, METHOD_LABEL, methodOptions, useMergeMethod } from './merge';
import { MUTATIONS, type PullRequest, type Repo } from './query';
import { usePrMutation } from './usePrMutation';

// The card is 320px wide with 12px padding, so the track is 296×48. A 4px inset around the 64×40 grip lets it
// travel 296 - 8 - 64 = 224px. The card's height (146px) sets how far `toastsLifted` lifts the toasts.
const TRAVEL = 224;
/** Released past this share of the travel, the grip finishes the slide itself. */
const CONFIRM_AT = 0.9;

/**
 * A floating card in the bottom-right corner that merges the PR: the merge method (its title opens the method menu,
 * shared with the merge box), the branches, and a slider. It shows on every PR tab while the PR can merge in one
 * step (see `canMergeNow`) and the setting is on.
 */
export function SlideToMerge({ pr, repo, queryKey }: { pr: PullRequest; repo: Repo; queryKey: QueryKey }) {
  const on = useStorageItem(slideToMergeItem);
  if (!on || !canMergeNow(pr, repo)) return null;
  return <Slider pr={pr} repo={repo} queryKey={queryKey} />;
}

function Slider({ pr, repo, queryKey }: { pr: PullRequest; repo: Repo; queryKey: QueryKey }) {
  const { methods, method, setMethod } = useMergeMethod(pr, repo);
  const merge = usePrMutation(queryKey);
  const busy = merge.isPending || merge.isSuccess;
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; p: number } | null>(null);
  const head = pr.isCrossRepository && pr.headRepositoryOwner ? `${pr.headRepositoryOwner.login}:${pr.headRefName}` : pr.headRefName;

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

  const title = (
    <>
      <HugeiconsIcon icon={GitMergeIcon} className="size-4 shrink-0 text-fg/80" />
      <span className="truncate">{METHOD_LABEL[method]}</span>
    </>
  );

  return (
    <div className="group/card fixed right-4 bottom-4 z-40 w-[320px] animate-pop rounded-2xl border border-line-strong bg-panel/85 p-3 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl select-none">
      <div className="px-1">
        {methods.length > 1 ? (
          <Menu
            value={method}
            options={methodOptions(methods)}
            onChange={setMethod}
            trigger={(open) => (
              <button
                type="button"
                onClick={open}
                disabled={busy}
                title="Choose merge method"
                className="-mx-1 flex h-5 max-w-full cursor-pointer items-center gap-2 rounded-md px-1 text-[13px] font-medium text-fg outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none"
              >
                {title}
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 shrink-0 text-muted" />
              </button>
            )}
          />
        ) : (
          <div className="flex h-5 items-center gap-2 text-[13px] font-medium text-fg">{title}</div>
        )}
        <p className="mt-1 truncate text-[12px] leading-4 text-muted">{METHOD_HINT[method]}</p>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] leading-4 text-muted">
          <span className="shrink-0 text-fg/85">{pr.baseRefName}</span>
          <span aria-hidden>←</span>
          <span className="sr-only">from</span>
          <span className="truncate">{head}</span>
        </p>
      </div>
      <div ref={track} className="group relative mt-3 h-12 rounded-full bg-fg/[0.05] shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)]">
        <span aria-hidden className="absolute inset-1 overflow-hidden rounded-full">
          <span
            className="block size-full rounded-full bg-accent transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-data-held:transition-none"
            style={{ transform: `translateX(calc((var(--p, 0) - 1) * ${TRAVEL}px))` }}
          />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 left-[76px] flex items-center transition-opacity duration-200 group-data-held:transition-none"
          style={{ opacity: 'calc(1 - var(--p, 0) * 2)' }}
        >
          {/* A light sweeps over the label: twice when the card appears, and again while the user hovers or focuses it. */}
          <span className="animate-sweep bg-[linear-gradient(90deg,var(--color-muted)_40%,var(--color-fg)_50%,var(--color-muted)_60%)] bg-size-[300%_100%] bg-clip-text text-[13px] text-transparent group-focus-within/card:[animation-iteration-count:infinite] group-hover/card:[animation-iteration-count:infinite] motion-reduce:animate-none">
            Slide to merge…
          </span>
        </span>
        <span role="status" className="pointer-events-none absolute inset-y-0 right-[76px] left-3 grid place-items-center text-[13px] font-medium text-accent-fg">
          {busy && <span className="animate-pop">{merge.isSuccess ? 'Merged' : 'Merging…'}</span>}
        </span>
        <button
          type="button"
          aria-label={`Slide to ${METHOD_LABEL[method].toLowerCase()}`}
          aria-disabled={busy}
          className="absolute top-1 left-1 flex h-10 w-16 cursor-grab touch-none items-center justify-center rounded-full bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_8px_rgb(0_0_0/0.3)] transition-[transform,filter] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] outline-none group-data-held:cursor-grabbing group-data-held:transition-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-default"
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
            icon={merge.isSuccess ? Tick02Icon : merge.isPending ? Loading03Icon : ArrowRight02Icon}
            className={merge.isPending ? 'size-4.5 animate-spin' : 'size-4.5'}
            strokeWidth={2.2}
          />
        </button>
      </div>
    </div>
  );
}
