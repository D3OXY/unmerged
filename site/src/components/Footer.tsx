import { InstallButtons } from './InstallButtons';
import { Logo } from './ui';
import { FORK_URL, NEW_ISSUE_URL, REPO_URL, TAGLINE } from '../site';

const FOOTER_LINKS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/#pages', label: 'Pages' },
      { href: '/#speed', label: 'Speed' },
      { href: '/#keyboard', label: 'Keyboard' },
      { href: '/install', label: 'Install' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { href: REPO_URL, label: 'Source code' },
      { href: FORK_URL, label: 'Fork' },
      { href: '/install/source', label: 'Build from source' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/support', label: 'Support' },
      { href: '/token', label: 'Why a token' },
      { href: NEW_ISSUE_URL, label: 'Report a problem' },
      { href: '/privacy', label: 'Privacy policy' },
    ],
  },
];

/** On every page: Holdout, the tagline and the install buttons on the left, link columns on the right, then the credits and a large wordmark. */
export function Footer() {
  return (
    <footer className="mx-auto mt-40 max-w-[1120px] overflow-hidden px-6">
      <div className="grid gap-12 border-t border-line pt-14 md:grid-cols-[minmax(0,1fr)_auto] md:gap-20">
        <div>
          <Logo size={40} />
          <p className="mt-5 mb-7 max-w-[320px] text-[20px] leading-snug font-medium tracking-[-0.02em] text-balance">{TAGLINE}</p>
          <InstallButtons />
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
          {FOOTER_LINKS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-[13px] text-subtle">{column.title}</h2>
              <ul className="mt-4 space-y-3 text-[14px] text-muted">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="transition-colors hover:text-fg">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="mt-20 flex flex-col gap-3 text-[12.5px] text-subtle sm:flex-row sm:items-center sm:justify-between">
        <span>Not affiliated with GitHub.</span>
        <a
          href="https://deoxy.dev"
          aria-label="Designed and engineered by DEOXY"
          className="font-mono whitespace-nowrap transition-opacity hover:opacity-80"
        >
          <span className="text-violet-400">&lt;Designed/&gt;</span> &amp; <span className="text-emerald-400">Engineered()</span> by{' '}
          <span className="font-semibold text-blue-500">DEOXY</span>
        </a>
      </div>
      <p
        aria-hidden
        className="mt-6 -mb-[0.22em] text-center text-[clamp(72px,19vw,232px)] leading-none font-medium tracking-[-0.06em] text-panel select-none"
      >
        Unmerged
      </p>
    </footer>
  );
}
