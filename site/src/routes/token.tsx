import { createFileRoute } from '@tanstack/react-router';
import { DocPage, Lede, Section } from '../components/doc';
import { REPO_URL, TOKEN_DOCS_URL, TOKEN_URL } from '../site';

// Why the extension asks for a token, and how it keeps it safe. The extension links here wherever it asks for one
// (TOKEN_HELP_URL in src/lib/settings.ts). Keep it true to what the extension does.
export const Route = createFileRoute('/token')({
  head: () => ({ meta: [{ title: 'Why Unmerged needs a GitHub token · Unmerged' }] }),
  component: Token,
});

/** Each classic scope the token link asks for, and what Unmerged does with it. */
const SCOPES: { scope: string; use: string }[] = [
  { scope: 'repo', use: 'Read repositories, pull requests and issues, private ones too, and comment, review and merge when you do.' },
  { scope: 'read:org', use: 'Show your organizations and their teams, for example to request a review from a team.' },
  { scope: 'read:user', use: 'Show your name and avatar.' },
  { scope: 'user:follow', use: 'Follow and unfollow people from their profile.' },
  { scope: 'notifications', use: 'Show the Notifications page and mark notifications as done.' },
  { scope: 'project', use: 'Show and change the projects of a pull request.' },
];

function Token() {
  return (
    <DocPage title="Why Unmerged needs a GitHub token">
      <Lede>
        Unmerged shows GitHub's pages with its own interface. It gets your pull requests, issues and notifications from
        GitHub's API, the same API that tools like the GitHub CLI use. The API only answers requests that come with a
        token, so Unmerged asks you for one. You make the token on GitHub, you choose what it can do, and you can revoke
        it at any time.
      </Lede>

      <Section title="Where your token goes">
        <ul>
          <li>
            <b>Only to GitHub's API (api.github.com)</b>, over HTTPS. Unmerged has no server, so the token never comes
            to us or to anyone else.
          </li>
          <li>
            <b>Into the extension's own storage</b>, on this device. Web pages, github.com included, can't read it.
          </li>
          <li>
            <b>Never onto github.com.</b> You paste the token into Unmerged's settings, a page of the extension, not into
            github.com. Unmerged never puts it in a page, a link or github.com's local storage, so GitHub's scripts and
            other extensions can't read it.
          </li>
        </ul>
      </Section>

      <Section title="What the token can do">
        <p>
          The <a href={TOKEN_URL}>"Create a token" link</a> opens GitHub's form with these scopes already set. Unmerged
          uses each one for this:
        </p>
        <ul>
          {SCOPES.map(({ scope, use }) => (
            <li key={scope}>
              <code>{scope}</code>: {use}
            </li>
          ))}
        </ul>
        <p>
          Unmerged changes something on GitHub only when you act, for example when you comment, review or merge. Classic
          tokens have no read-only scope for private repositories, so <code>repo</code> can also write. If you only read
          public code, use <code>public_repo</code> in its place.
        </p>
      </Section>

      <Section title="Why the token has no expiration">
        <p>
          The link sets the expiration to "No expiration", so Unmerged doesn't stop working one day without a warning.
          If you prefer, pick a date in GitHub's form before you click <b>Generate token</b>. When the token expires,
          Unmerged tells you and asks for a new one.
        </p>
      </Section>

      <Section title="Want to give it less access?">
        <p>
          Use a fine-grained token. It works for one account or organization, and you give it only the permissions you
          pick. The <a href={TOKEN_DOCS_URL}>README lists which permission each feature needs</a>. The Notifications page
          needs a classic token, so switch that page off in Unmerged's settings if you use a fine-grained one.
        </p>
      </Section>

      <Section title="Stop it at any time">
        <ul>
          <li>
            <b>Disconnect</b> in Unmerged's settings deletes the token and everything cached for it.
          </li>
          <li>
            <b>Revoke the token on GitHub</b>, on the <a href="https://github.com/settings/tokens">tokens page</a>. It
            stops working at once, everywhere.
          </li>
          <li>
            <b>Remove the extension</b>, and the browser deletes all of its storage.
          </li>
        </ul>
      </Section>

      <Section title="Check it yourself">
        <p>
          All of Unmerged's code is <a href={REPO_URL}>open source</a>, so you can read how it uses the token. The{' '}
          <a href="/privacy">privacy policy</a> lists everything Unmerged stores and sends.
        </p>
      </Section>
    </DocPage>
  );
}
