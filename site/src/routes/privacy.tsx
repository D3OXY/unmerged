import type { ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Logo } from '../components/ui';
import { REPO_URL } from '../site';

// The privacy policy the extension stores link to. Keep it true to what the extension does.
export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy policy · Unmerged' }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-[680px] px-6 pt-10 pb-24">
      <a href="/" className="flex w-fit items-center gap-2 text-[15px] font-semibold tracking-tight">
        <Logo />
        Unmerged
      </a>
      <h1 className="mt-16 text-[34px] leading-[1.1] font-semibold tracking-[-0.03em]">Privacy policy</h1>
      <p className="mt-3 text-[13px] text-subtle">Last updated October 18, 2026</p>
      <p className="mt-8 text-[15px] leading-relaxed text-muted">
        Unmerged is a browser extension that re-skins github.com. It has no server, no accounts, no analytics and no
        crash reporting. Its developer never receives any of your data, and nothing is sold or shared.
      </p>

      <Section title="What Unmerged stores">
        <p>Everything stays in your browser:</p>
        <ul>
          <li>
            <b>Your GitHub token</b>, in the extension's own storage. Web pages, github.com included, can't read it.
          </li>
          <li>
            <b>Recent GitHub results</b> (the pages you've opened), filed under your GitHub account, and unsent comment
            drafts, in the extension's storage. Results older than 7 days are never shown and get removed, and the cache
            is capped at 50 MB.
          </li>
          <li>
            <b>Your settings</b>, in the extension's storage.
          </li>
          <li>
            <b>A few things in github.com's local storage</b>, so pages draw instantly: your appearance and theme colors,
            diff view preferences, dismissed banners, and for the sidebar your GitHub username, name, avatar,
            organizations and the names of repositories you recently worked in (private ones included). GitHub's own
            scripts, and other extensions allowed on github.com, can read this storage. The account details are removed
            when you change your token or disconnect.
          </li>
        </ul>
      </Section>

      <Section title="What Unmerged sends, and where">
        <ul>
          <li>
            <b>To GitHub's API (api.github.com)</b>, with your token: requests for what you're looking at, and the
            actions you take, like commenting, reviewing or merging. Your token is only ever sent there.
          </li>
          <li>
            <b>To github.com and GitHub's image hosts</b>, with your usual GitHub session, as GitHub's own pages would.
          </li>
          <li>
            <b>To another website only when you play a video</b> linked from a GitHub page that is hosted there.
          </li>
        </ul>
        <p>Nothing else. GitHub's handling of that data is covered by GitHub's own privacy statement.</p>
      </Section>

      <Section title="Permissions">
        <ul>
          <li>
            <b>Access to github.com</b>: to draw Unmerged's pages in place of GitHub's.
          </li>
          <li>
            <b>Access to api.github.com</b>: to load the data those pages show.
          </li>
          <li>
            <b>Storage and unlimited storage</b>: for your token, settings and cache. The cache can grow past the
            browser's default 10 MB limit.
          </li>
        </ul>
      </Section>

      <Section title="Removing your data">
        <p>
          Disconnecting your token in Unmerged's settings deletes it and everything cached for it.
          Uninstalling the extension deletes all of its storage. The entries Unmerged keeps in github.com's local storage
          start with <code>unmerged:</code> and go away when you clear github.com's site data in your browser.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, the new version appears on this page with a new date. Questions go to{' '}
          <a href={`${REPO_URL}/issues`}>the issue tracker</a>. Unmerged is not affiliated with GitHub.
        </p>
      </Section>
    </div>
  );
}

/** A heading and its prose; lists, links and code inside are styled here. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 space-y-4 text-[15px] leading-relaxed text-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-2 [&_b]:font-medium [&_b]:text-fg [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-fg/90 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-5">
      <h2 className="text-[19px] font-semibold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}
