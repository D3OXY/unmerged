import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, ReloadIcon } from '@hugeicons/core-free-icons';
import { isUnpacked } from '@/lib/settings';
import { createStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Logo } from './Logo';
import { SettingsPanel, type SettingsPage } from './SettingsPanel';

/** The page the Settings dialog is open on, or null while it's closed. */
export const settingsOpen = createStore<SettingsPage | null>(null);

/**
 * Reloads an unpacked extension after a `pnpm build`, then this page so it runs the new build. The page
 * waits a moment for the extension to come back; this script is cut off from it once the reload starts.
 */
function reloadExtension() {
  browser.runtime.sendMessage('reload');
  setTimeout(() => location.reload(), 800);
}

/** The popup's settings over any Unmerged page; opened from the sidebar's gear or ⌘K. */
export function SettingsDialog() {
  const page = settingsOpen.use();
  if (!page) return null;
  return <Dialog page={page} />;
}

function Dialog({ page }: { page: SettingsPage }) {
  const close = () => settingsOpen.set(null);

  return (
    <Modal label="Settings" onClose={close} className="flex h-[min(600px,80vh)] w-[720px] flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo size={22} />
        <span className="flex-1 text-[14px] font-semibold tracking-tight">Settings</span>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </header>

      <SettingsPanel key={page} initialPage={page} onClose={close} />

      <footer className="flex h-11 shrink-0 items-center justify-between border-t border-line px-4 text-[11.5px] text-subtle">
        <span className="tabular-nums">Unmerged v{browser.runtime.getManifest().version}</span>
        {isUnpacked() && (
          <Button size="sm" variant="ghost" icon={<HugeiconsIcon icon={ReloadIcon} className="size-3.5" />} onClick={reloadExtension}>
            Reload extension
          </Button>
        )}
      </footer>
    </Modal>
  );
}
