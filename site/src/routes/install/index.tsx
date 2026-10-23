import type { ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';
import { ChromeLogo, FirefoxLogo } from '../../components/brands';
import { Footer } from '../../components/Footer';
import { SendCard } from '../../components/InstallButtons';
import { Nav } from '../../components/Nav';
import { Setup } from '../../components/Setup';
import { AlphaPill, BUTTON } from '../../components/ui';
import { useBrowser } from '../../install';
import { CHROME_STORE_URL, FIREFOX_STORE_URL, NEW_ISSUE_URL } from '../../site';

// Where Install goes when the browser can't install from a store (see useInstallHref): phones and unknown browsers.
export const Route = createFileRoute('/install/')({
  head: () => ({ meta: [{ title: 'Install · Unmerged' }] }),
  component: Install,
});

function Install() {
  const phone = useBrowser() === 'phone';
  return (
    <div className="relative overflow-x-clip">
      <Nav />
      <main className="mx-auto max-w-[1120px] px-6">
        <header className="flex flex-col items-center pt-16 text-center sm:pt-24">
          <h1 className="text-[40px] leading-[1.05] font-medium tracking-[-0.04em] sm:text-[56px]">Install Unmerged</h1>
          <p className="mt-4 max-w-[480px] text-[16px] leading-relaxed text-muted text-pretty">
            Free and open source, with no account. Pick your browser.
          </p>
          <p className="mt-4 text-[13px] leading-6 text-subtle">
            <AlphaPill />
            Unmerged changes often, and some things can break.{' '}
            <a href={NEW_ISSUE_URL} className="text-muted underline underline-offset-2 transition-colors hover:text-fg">
              Report a problem
            </a>
          </p>
        </header>

        {phone && (
          <div className="mx-auto mt-10 max-w-[420px]">
            <SendCard />
          </div>
        )}

        <div className="mx-auto mt-14 grid max-w-[832px] gap-2 sm:grid-cols-2">
          <Browser
            logo={<ChromeLogo className="size-7" />}
            name="Chrome"
            note="Also Arc, Brave, Edge and other Chromium browsers."
            href={CHROME_STORE_URL}
          />
          <Browser logo={<FirefoxLogo className="size-7" />} name="Firefox" note="Firefox 140 or later, on desktop." href={FIREFOX_STORE_URL} />
        </div>

        <p className="mt-10 text-center text-[13.5px] text-subtle">
          Prefer your own build?{' '}
          <a href="/install/source" className="text-muted underline underline-offset-2 transition-colors hover:text-fg">
            Build it from source
          </a>
          .
        </p>

        <section className="pt-32 sm:pt-40">
          <h2 className="mb-12 max-w-[880px] text-[24px] leading-[1.25] font-medium tracking-[-0.025em] text-pretty sm:mb-14 sm:text-[30px]">
            Set up in three steps. <span className="text-muted">Add the extension, paste a token, then use GitHub as you do now.</span>
          </h2>
          <Setup />
        </section>
      </main>
      <Footer />
    </div>
  );
}

/** One browser: its logo and name, a line about it, then the button to its store at the bottom. */
function Browser({ logo, name, note, href }: { logo: ReactNode; name: string; note: string; href: string }) {
  return (
    <section className="flex flex-col rounded-lg bg-panel p-7">
      <div className="flex items-start justify-between">
        <span className="flex size-12 items-center justify-center rounded-lg bg-elevated text-fg">{logo}</span>
        <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Available
        </span>
      </div>
      <h2 className="mt-6 text-[22px] font-medium tracking-tight">{name}</h2>
      <p className="mt-2 mb-8 text-[14px] leading-relaxed text-muted">{note}</p>
      <a href={href} className={`${BUTTON.primary} mt-auto`}>
        <HugeiconsIcon icon={Download04Icon} className="size-[18px]" />
        Add to {name}
      </a>
    </section>
  );
}
