import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, GitForkIcon, LaptopIcon, Share08Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { ChromeLogo, FirefoxLogo } from './brands';
import { BUTTON } from './ui';
import { useBrowser } from '../install';
import { CHROME_STORE_URL, FIREFOX_STORE_URL, FORK_URL, SITE_URL, TAGLINE } from '../site';

/**
 * How to install, for the hero and the footer. Desktop gets a button per store, the reader's own browser in cream.
 * Phones can't run the extension, so they get ways to send the site to a computer instead. The hero also shows
 * Fork, the browser requirements, and on phones a line that says why.
 */
export function InstallButtons({ hero = false }: { hero?: boolean }) {
  const browser = useBrowser();
  if (browser === 'phone') return hero ? <SendCard /> : <SendButtons />;

  const firefox = browser === 'firefox';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <a href={CHROME_STORE_URL} className={`${firefox ? BUTTON.secondary : BUTTON.primary} pl-4`}>
          <ChromeLogo className="size-[18px]" />
          Add to Chrome
        </a>
        <a href={FIREFOX_STORE_URL} className={`${firefox ? BUTTON.primary : BUTTON.secondary} pl-4`}>
          <FirefoxLogo className="size-[18px]" />
          Add to Firefox
        </a>
        {hero && (
          <a href={FORK_URL} className={`${BUTTON.outline} pl-4`}>
            <HugeiconsIcon icon={GitForkIcon} className="size-[18px]" />
            Fork
          </a>
        )}
      </div>
      {hero && (
        <p className="mt-4 text-[13px] leading-relaxed text-subtle">
          The Chrome Web Store also serves Arc, Brave and Edge. Firefox 140 or later. Desktop only.{' '}
          <a href="/install/source" className="text-muted underline underline-offset-2 transition-colors hover:text-fg">
            Build from source
          </a>
        </p>
      )}
    </div>
  );
}

/** The phone version of the hero's buttons, also on /install: why there is no install, then send, copy and Fork. */
export function SendCard() {
  return (
    <div className="max-w-[420px] rounded-xl border border-line bg-panel p-[18px]">
      <div className="flex gap-3">
        <HugeiconsIcon icon={LaptopIcon} className="mt-px size-5 shrink-0 text-muted" />
        <div>
          <p className="text-[14px] font-medium">Install it on your computer</p>
          <p className="mt-1 text-[13px] leading-normal text-muted">
            Unmerged runs in desktop Chrome, Arc, Brave, Edge and Firefox. Send this page to yourself to install it there.
          </p>
        </div>
      </div>
      <SendButtons fork className="mt-4" />
    </div>
  );
}

/**
 * Share opens the phone's own share sheet with the site's address, so the reader can send it to their computer; it
 * shows only where the browser has one. Copy puts the address on the clipboard. Nothing goes through a server.
 */
function SendButtons({ fork = false, className = '' }: { fork?: boolean; className?: string }) {
  const canShare = typeof navigator.share === 'function';
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () =>
    navigator.clipboard.writeText(SITE_URL).then(
      () => setCopied(true),
      () => {},
    );
  // Rejects when the reader closes the sheet; nothing to do then.
  const share = () => navigator.share({ title: 'Unmerged', text: TAGLINE, url: SITE_URL }).catch(() => {});

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {canShare && (
        <button type="button" onClick={share} className={`${BUTTON.primary} col-span-2 cursor-pointer`}>
          <HugeiconsIcon icon={Share08Icon} className="size-[18px]" />
          Send to my computer
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className={`${canShare ? BUTTON.secondary : BUTTON.primary} cursor-pointer ${fork ? '' : 'col-span-2'}`}
      >
        <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="size-4" />
        <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
      </button>
      {fork && (
        <a href={FORK_URL} className={BUTTON.outline}>
          <HugeiconsIcon icon={GitForkIcon} className="size-4" />
          Fork
        </a>
      )}
    </div>
  );
}
