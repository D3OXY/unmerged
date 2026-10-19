import type { ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { ArrowRight01Icon, BrowserIcon, ChromeIcon } from '@hugeicons/core-free-icons';
import { DocPage, Lede, Section } from '../../components/doc';
import { CHROME_STORE_URL, TOKEN_URL } from '../../site';

// Where Install goes when the browser can't install from the Chrome Web Store (see useInstallHref).
export const Route = createFileRoute('/install/')({
  head: () => ({ meta: [{ title: 'Install · Unmerged' }] }),
  component: Install,
});

function Install() {
  return (
    <DocPage title="Install">
      <Lede>Unmerged runs in Chromium browsers today. Firefox is on its way.</Lede>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Browser icon={ChromeIcon} name="Chrome" status="Available">
          <p>Chrome, Arc, Brave, Edge and other Chromium browsers.</p>
          <a
            href={CHROME_STORE_URL}
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg bg-fg px-3 text-[13px] font-medium text-bg transition-opacity hover:opacity-90"
          >
            Add to Chrome
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </a>
        </Browser>
        <Browser icon={BrowserIcon} name="Firefox" status="Coming soon">
          <p>In review at Firefox Add-ons.</p>
        </Browser>
      </div>

      <Section title="Then add a token">
        <p>
          Open github.com and paste a personal access token when Unmerged asks. <a href={TOKEN_URL}>This link</a> fills in
          the scopes it needs.
        </p>
      </Section>

      <Section title="Build from source">
        <p>
          Want your own build, or Firefox before the store approves it? <a href="/install/source">Build it from source</a>.
        </p>
      </Section>
    </DocPage>
  );
}

/** A browser's card: its icon, name and availability, then how to get Unmerged there. */
function Browser({ icon, name, status, children }: { icon: IconSvgElement; name: string; status: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/60 p-6 text-[13.5px] leading-relaxed text-muted">
      <div className="flex items-center gap-2.5">
        <HugeiconsIcon icon={icon} className="size-5 text-fg" />
        <h2 className="text-[15px] font-semibold tracking-tight text-fg">{name}</h2>
        <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[11.5px] text-subtle">{status}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
