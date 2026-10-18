import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { createStore } from '@/lib/store';

/** A button on a toast; it dismisses the toast once run. */
type Action = { label: string; run: () => void };

type Toast = { id: number; tone: 'success' | 'error'; message: string; action?: Action };

const toasts = createStore<Toast[]>([]);
let nextId = 0;

/** True while Slide to merge holds the bottom-right corner, so toasts show above it. */
export const toastsLifted = createStore(false);

const dismiss = (id: number) => toasts.set(toasts.get().filter((x) => x.id !== id));

function push(t: Omit<Toast, 'id'>) {
  const id = nextId++;
  toasts.set([...toasts.get(), { ...t, id }]);
  // Toasts with an action stay longer, so there's time to reach for it.
  setTimeout(() => dismiss(id), t.action ? 8000 : 4500);
}

/** Fire-and-forget notifications, optionally with one action. `toast.error(err)` accepts anything thrown. */
export const toast = {
  success: (message: string, action?: Action) => push({ tone: 'success', message, action }),
  error: (error: unknown) => push({ tone: 'error', message: error instanceof Error ? error.message : String(error) }),
};

export function Toaster() {
  const list = toasts.use();
  const lifted = toastsLifted.use();
  return (
    <div className={cx('pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2 transition-transform duration-300', lifted && '-translate-y-14')}>
      {list.map(({ id, tone, message, action }) => (
        <div
          key={id}
          className="pointer-events-auto flex max-w-sm animate-pop items-start gap-2.5 rounded-xl border border-line-strong bg-elevated px-3.5 py-2.5 text-[13px] shadow-2xl shadow-black/30"
        >
          {tone === 'success' ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mt-px size-4 shrink-0 text-success" />
          ) : (
            <HugeiconsIcon icon={AlertCircleIcon} className="mt-px size-4 shrink-0 text-danger" />
          )}
          <span className="whitespace-pre-line">{message}</span>
          {action && (
            <button
              type="button"
              onClick={() => {
                action.run();
                dismiss(id);
              }}
              className="-my-0.5 ml-1 cursor-pointer rounded-md px-1.5 py-0.5 font-medium whitespace-nowrap text-accent hover:bg-hover"
            >
              {action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
