import { cx } from '@/lib/cx';

/** Shown where a failed request's content would be ("Couldn't load the README"), with GitHub's reason and a retry. */
export function LoadError({ what, error, retry, className }: { what: string; error: Error; retry: () => unknown; className?: string }) {
  return (
    <div className={cx('text-[12.5px]', className)}>
      <p className="text-danger">Couldn't load {what}.</p>
      <p className="mt-1 text-subtle">{error.message}</p>
      <button type="button" onClick={() => retry()} className="mt-2 cursor-pointer text-accent hover:underline">
        Retry
      </button>
    </div>
  );
}
