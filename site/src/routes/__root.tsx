import type { ReactNode } from 'react';
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import favicon from '../../../src/assets/logo/holdout-16.svg?url';
import appleIcon from '../../../public/icon/128.png?url';
import { DESCRIPTION, SITE_URL, TAGLINE } from '../site';
import appCss from '../styles.css?url';

const TITLE = `Unmerged: ${TAGLINE}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'theme-color', content: '#08090a' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: favicon },
      { rel: 'apple-touch-icon', href: appleIcon },
      { rel: 'canonical', href: SITE_URL },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The extension's tokens are scoped to `.u-root`; the site is dark only.
    <html lang="en" className="u-root dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
