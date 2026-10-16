import './style.css';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HugeiconsIcon } from '@hugeicons/react';
import { ReloadIcon } from '@hugeicons/core-free-icons';
import { browser } from 'wxt/browser';
import { localCache } from '@/lib/localCache';
import { isDark, isUnpacked, themeItem, useStorageItem, type Theme } from '@/lib/settings';
import { Logo } from '@/app/Logo';
import { SettingsPanel } from '@/app/SettingsPanel';

// The popup's own copy of the theme, read before first paint so it doesn't open in the wrong one.
const themeCache = localCache<Theme>('theme');
const applyTheme = (theme: Theme) => document.documentElement.classList.toggle('dark', isDark(theme));
applyTheme(themeCache.get() ?? 'auto');

/** Toolbar popup, also served in a tab as the options page: the settings panel under Unmerged's name. */
function Popup() {
  const theme = useStorageItem(themeItem);

  useEffect(() => {
    if (!theme) return;
    themeCache.set(theme);
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo size={28} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-tight font-semibold tracking-tight">Unmerged</div>
          <div className="text-[11.5px] text-subtle">GitHub, as if it never got acquired.</div>
        </div>
        <ReloadButton />
      </header>

      <SettingsPanel />

      <footer className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11.5px] text-subtle">
        <span>
          Press <kbd className="rounded border border-line bg-elevated px-1 font-sans text-[10.5px] text-muted">⌘K</kbd> on GitHub
        </span>
        <span className="tabular-nums">v{browser.runtime.getManifest().version}</span>
      </footer>
    </div>
  );
}

/** Only for unpacked installs: re-reads the extension from disk after a `pnpm build`. Open GitHub tabs need a refresh. */
function ReloadButton() {
  if (!isUnpacked()) return null;
  return (
    <button
      type="button"
      onClick={() => browser.runtime.reload()}
      title="Reload extension"
      aria-label="Reload extension"
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-fg"
    >
      <HugeiconsIcon icon={ReloadIcon} className="size-3.5" />
    </button>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
