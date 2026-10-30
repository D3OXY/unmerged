import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { NEW_TOKEN_URL, openSettingsPage } from '@/lib/settings';
import { openClassic } from '@/lib/classic';
import { Button } from '@/ui/Button';
import { Logo } from './Logo';

/**
 * Shown until a GitHub token is saved (or after GitHub rejects the saved one). The token is entered in
 * Unmerged's own settings page, never on github.com; this tab reloads once it's saved.
 */
export function TokenGate({ rejected }: { rejected?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px] animate-enter">
        <Logo size={36} />
        <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Welcome to Unmerged</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          GitHub, as if it never got acquired. Unmerged reads GitHub's API with a personal access token, which you add in
          Unmerged's settings rather than on this page.
        </p>
        {rejected && <p className="mt-3 text-[13px] text-danger">GitHub rejected the saved token. Add a new one in settings.</p>}
        <Button variant="primary" onClick={openSettingsPage} className="mt-6 w-full justify-center">
          Open Unmerged settings <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5" />
        </Button>
        <p className="mt-2 text-center text-[12px] text-subtle">Or click Unmerged's icon in the browser toolbar.</p>
        <div className="mt-5 flex items-center justify-between text-[12.5px]">
          <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Create a token →
          </a>
          <button type="button" onClick={openClassic} className="cursor-pointer text-subtle hover:text-fg">
            Use classic GitHub
          </button>
        </div>
        <p className="mt-6 text-[12px] leading-relaxed text-subtle">
          The token is kept in the extension's storage and sent only to api.github.com. Classic token scopes:{' '}
          <code className="font-mono">repo</code>, <code className="font-mono">read:org</code>,{' '}
          <code className="font-mono">read:user</code>, <code className="font-mono">user:follow</code>,{' '}
          <code className="font-mono">notifications</code>, <code className="font-mono">project</code>. A fine-grained token can be limited to the repos and
          permissions you pick; Notifications still needs a classic one.
        </p>
      </div>
    </div>
  );
}
