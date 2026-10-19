import type { ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Download04Icon } from '@hugeicons/core-free-icons';
import { ChromeLogo, FirefoxLogo } from '../../components/brands';
import { Logo } from '../../components/ui';
import { CHROME_STORE_URL } from '../../site';

// Where Install goes when the browser can't install from the Chrome Web Store (see useInstallHref).
export const Route = createFileRoute('/install/')({
  head: () => ({ meta: [{ title: 'Install · Unmerged' }] }),
  component: Install,
});

function Install() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--u-accent)_18%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[880px] px-6 pt-10 pb-24">
        <a href="/" className="flex w-fit items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Logo />
          Unmerged
        </a>

        <header className="mt-20 flex flex-col items-center text-center">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[52px]">Install Unmerged</h1>
          <p className="mt-4 max-w-[480px] text-[16px] leading-relaxed text-muted text-pretty">
            Free and open source, with no account. Pick your browser.
          </p>
        </header>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          <Browser
            logo={<ChromeLogo className="size-7" />}
            name="Chrome"
            status={<Status ready>Available</Status>}
            note="Also Arc, Brave, Edge and other Chromium browsers."
            featured
          >
            <a
              href={CHROME_STORE_URL}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[14.5px] font-medium text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_30px_-12px_var(--u-accent)] transition-[filter,scale] duration-150 hover:brightness-110 active:scale-[0.97]"
            >
              <HugeiconsIcon icon={Download04Icon} className="size-[18px]" />
              Add to Chrome
            </a>
          </Browser>
          <Browser
            logo={<FirefoxLogo className="size-7" />}
            name="Firefox"
            status={<Status>Coming soon</Status>}
            note="Firefox Add-ons is reviewing it. Until then, you can build it yourself."
          >
            <a
              href="/install/source"
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 text-[14.5px] font-medium transition-[background-color,scale] duration-150 hover:bg-white/[0.12] active:scale-[0.97]"
            >
              Build from source
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </a>
          </Browser>
        </div>

        <p className="mt-10 text-center text-[13.5px] text-subtle">
          Prefer your own build?{' '}
          <a href="/install/source" className="text-muted underline underline-offset-2 transition-colors hover:text-fg">
            Build it from source
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/** One browser: its logo, name and availability, a line about it, then its action at the bottom. */
function Browser({ logo, name, status, note, featured, children }: { logo: ReactNode; name: string; status: ReactNode; note: string; featured?: boolean; children: ReactNode }) {
  return (
    <section
      className={`flex flex-col rounded-3xl border p-7 ${featured ? 'border-accent/30 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--u-accent)_10%,transparent),transparent_60%)]' : 'border-line bg-panel/60'}`}
    >
      <div className="flex items-start justify-between">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-fg">{logo}</span>
        {status}
      </div>
      <h2 className="mt-6 text-[22px] font-semibold tracking-tight">{name}</h2>
      <p className="mt-2 mb-8 text-[14px] leading-relaxed text-muted">{note}</p>
      <div className="mt-auto">{children}</div>
    </section>
  );
}

/** Availability with a colored dot: green when it can be installed now. */
function Status({ ready, children }: { ready?: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
      <span className={`size-1.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {children}
    </span>
  );
}
