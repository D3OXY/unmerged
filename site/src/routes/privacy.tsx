import { createFileRoute } from '@tanstack/react-router';
import { DocPage, Lede, Section } from '../components/doc';
import { SUPPORT_EMAIL } from '../site';

// The privacy policy the extension stores link to. Keep it true to what the extension and this website do.
export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy policy · Unmerged' }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <DocPage title="Privacy policy" updated="November 3, 2026">
      <Lede>
        Unmerged is a browser extension that re-skins github.com. It has no server, no accounts, no analytics and no
        crash reporting. Its developer never receives any of your data, and nothing is sold or shared.
      </Lede>

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
            <b>Web requests</b>: to see when a tab starts to load a github.com page, so its data starts loading at once.
            Unmerged doesn't read, block or change those requests, and sees no other site's.
          </li>
          <li>
            <b>Changing which github.com page loads</b> (Chrome): when you open a page that Unmerged shows, the browser
            loads a small GitHub page in its place, which GitHub sends faster than the full page. Unmerged then puts
            the real address back. The request still goes to github.com, and Unmerged reads none of it.
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

      <Section title="This website">
        <p>
          This website (unmerged.deoxy.dev), not the extension, counts visits with Vercel Web Analytics: which pages
          are viewed, the referring site, and the country, browser and device type. It uses no cookies and stores no
          personal data.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, the new version appears on this page with a new date. Questions go to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Unmerged is not affiliated with GitHub.
        </p>
      </Section>
    </DocPage>
  );
}
