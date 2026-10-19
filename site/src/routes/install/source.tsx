import { createFileRoute } from '@tanstack/react-router';
import { DocPage, Lede, Section } from '../../components/doc';
import { FORK_URL, REPO_URL, TOKEN_URL } from '../../site';

export const Route = createFileRoute('/install/source')({
  head: () => ({ meta: [{ title: 'Build from source · Unmerged' }] }),
  component: Source,
});

function Source() {
  return (
    <DocPage title="Build from source">
      <Lede>
        You need Git, Node 24 and pnpm. Clone the repository, or <a href={FORK_URL}>fork it</a> first if you want to
        change things.
      </Lede>
      <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-panel px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-fg/90">
        {`git clone ${REPO_URL}
cd unmerged
pnpm install
pnpm build            # Chrome → .output/chrome-mv3
pnpm build:firefox    # Firefox → .output/firefox-mv2`}
      </pre>

      <Section title="Load it in Chrome">
        <p>
          Open <code>chrome://extensions</code>, turn on Developer mode, click <b>Load unpacked</b> and pick{' '}
          <code>.output/chrome-mv3</code>. Arc, Brave and Edge work the same way from their extensions page.
        </p>
      </Section>

      <Section title="Load it in Firefox">
        <p>
          Open <code>about:debugging#/runtime/this-firefox</code>, click <b>Load Temporary Add-on</b> and pick{' '}
          <code>.output/firefox-mv2/manifest.json</code>. It needs Firefox 140 or later, and Firefox removes it when it
          restarts.
        </p>
      </Section>

      <Section title="Then add a token">
        <p>
          Click the Unmerged toolbar icon and paste a personal access token. <a href={TOKEN_URL}>This link</a> fills in
          the scopes it needs.
        </p>
      </Section>

      <Section title="Updating">
        <p>
          A build doesn't update itself. Pull, run the build again, then reload Unmerged on the extensions page.
        </p>
      </Section>
    </DocPage>
  );
}
