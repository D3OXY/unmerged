import { createFileRoute } from '@tanstack/react-router';
import { DocPage, Lede, Section } from '../components/doc';
import { SUPPORT_EMAIL, TOKEN_URL } from '../site';

// The support page the extension stores link to.
export const Route = createFileRoute('/support')({
  head: () => ({ meta: [{ title: 'Support · Unmerged' }] }),
  component: Support,
});

function Support() {
  return (
    <DocPage title="Support">
      <Lede>
        Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
        with your browser, the github.com address of the page, and what you expected to happen. Never send your token.
      </Lede>

      <Section title="Before you write">
        <ul>
          <li>
            <b>A page looks wrong.</b> Classic (in the sidebar, or ⌘K) shows GitHub's own page for the same address, and
            each page Unmerged takes over can be switched off from the toolbar popup.
          </li>
          <li>
            <b>"GitHub rejected the saved token."</b> The token expired or was revoked.{' '}
            <a href={TOKEN_URL}>Create a new one</a> and paste it into Unmerged's settings.
          </li>
          <li>
            <b>Private repositories or organizations are missing.</b> A classic token needs the <code>repo</code> and{' '}
            <code>read:org</code> scopes. A fine-grained token covers one account or organization, and an organization
            may have to approve it.
          </li>
          <li>
            <b>Notifications don't load.</b> GitHub's notifications API only accepts classic tokens. Use one, or switch
            Notifications off in the popup.
          </li>
        </ul>
      </Section>

      <Section title="Privacy">
        <p>
          Unmerged has no server and collects nothing. The <a href="/privacy">privacy policy</a> lists what it stores
          and where it sends requests.
        </p>
      </Section>
    </DocPage>
  );
}
