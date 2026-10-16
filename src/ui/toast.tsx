import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { createStore } from '@/lib/store';

type Toast = { id: number; tone: 'success' | 'error'; message: string };

const toasts = createStore<Toast[]>([]);
let nextId = 0;

function push(t: Omit<Toast, 'id'>) {
  const id = nextId++;
  toasts.set([...toasts.get(), { ...t, id }]);
  setTimeout(() => toasts.set(toasts.get().filter((x) => x.id !== id)), 4500);
}

/** Fire-and-forget notifications. `toast.error(err)` accepts anything thrown. */
export const toast = {
  success: (message: string) => push({ tone: 'success', message }),
  error: (error: unknown) => push({ tone: 'error', message: error instanceof Error ? error.message : String(error) }),
};

export function Toaster() {
  const list = toasts.use();
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-sm animate-pop items-start gap-2.5 rounded-xl border border-line-strong bg-elevated px-3.5 py-2.5 text-[13px] shadow-2xl shadow-black/30"
        >
          {t.tone === 'success' ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mt-px size-4 shrink-0 text-success" />
          ) : (
            <HugeiconsIcon icon={AlertCircleIcon} className="mt-px size-4 shrink-0 text-danger" />
          )}
          <span className="whitespace-pre-line">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
