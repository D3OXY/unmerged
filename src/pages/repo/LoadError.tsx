import { GitHubError } from '@/github/client';
import { cx } from '@/lib/cx';

/**
 * Shown where a failed request's content would be ("Couldn't load the README"), with the reason and a retry.
 * Rate limits already read well; SSO gets a short line, since the global banner explains the fix.
 */
export function LoadError({ what, error, retry, className }: { what: string; error: Error; retry: () => unknown; className?: string }) {
  const sso = error instanceof GitHubError && error.problem.kind === 'sso';
  return (
    <div className={cx('text-[12.5px]', className)}>
      <p className="text-danger">Couldn't load {what}.</p>
      <p className="mt-1 text-subtle">{sso ? "This organization's SSO hasn't authorized your token." : error.message}</p>
      <button type="button" onClick={() => retry()} className="mt-2 cursor-pointer text-accent hover:underline">
        Retry
      </button>
    </div>
  );
}
