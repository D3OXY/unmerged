import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight02Icon, Key01Icon } from '@hugeicons/core-free-icons';
import { NEW_TOKEN_URL, tokenItem } from '@/lib/settings';
import { openClassic } from '@/lib/classic';
import { Button } from '@/ui/Button';
import { Logo } from './Logo';

/** Shown until a GitHub token is saved (or after GitHub rejects the saved one). */
export function TokenGate({ rejected }: { rejected?: boolean }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px] animate-enter">
        <Logo size={36} />
        <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Welcome to Unmerged</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          GitHub, as if it never got acquired. Unmerged reads from GitHub's API with a personal token that never leaves this
          browser.
        </p>
        {rejected && <p className="mt-3 text-[13px] text-danger">GitHub rejected the saved token. Paste a new one.</p>}
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            await tokenItem.setValue(value.trim());
            location.reload();
          }}
        >
          <label className="flex h-10 items-center gap-2.5 rounded-xl border border-line bg-panel px-3 focus-within:border-accent/60">
            <HugeiconsIcon icon={Key01Icon} className="size-4 text-subtle" />
            <input
              autoFocus
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ghp_… or github_pat_…"
              className="h-full flex-1 bg-transparent font-mono text-[12.5px] outline-none placeholder:text-subtle"
            />
          </label>
          <Button type="submit" variant="primary" disabled={!value.trim()} loading={saving} className="justify-center">
            Continue <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5" />
          </Button>
        </form>
        <div className="mt-5 flex items-center justify-between text-[12.5px]">
          <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Create a token →
          </a>
          <button type="button" onClick={openClassic} className="cursor-pointer text-subtle hover:text-fg">
            Use classic GitHub
          </button>
        </div>
        <p className="mt-6 text-[12px] leading-relaxed text-subtle">
          Scopes: <code className="font-mono">repo</code>, <code className="font-mono">read:org</code>,{' '}
          <code className="font-mono">read:user</code>, <code className="font-mono">user:follow</code>,{' '}
          <code className="font-mono">notifications</code> (for Watch). Fine-grained tokens work too.
        </p>
      </div>
    </div>
  );
}
