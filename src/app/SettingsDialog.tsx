import { RotateCw, X } from 'lucide-react';
import { isUnpacked } from '@/lib/settings';
import { createStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Logo } from './Logo';
import { SettingsPanel } from './SettingsPanel';

export const settingsOpen = createStore(false);

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
  const open = settingsOpen.use();
  if (!open) return null;
  return <Dialog />;
}

function Dialog() {
  const close = () => settingsOpen.set(false);

  return (
    <Modal label="Settings" onClose={close} className="w-[400px]">
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo size={22} />
        <span className="flex-1 text-[14px] font-semibold tracking-tight">Settings</span>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </header>

      <SettingsPanel />

      <footer className="flex h-11 items-center justify-between border-t border-line px-4 text-[11.5px] text-subtle">
        <span className="tabular-nums">Unmerged v{browser.runtime.getManifest().version}</span>
        {isUnpacked() && (
          <Button size="sm" variant="ghost" icon={<RotateCw className="size-3.5" />} onClick={reloadExtension}>
            Reload extension
          </Button>
        )}
      </footer>
    </Modal>
  );
}
