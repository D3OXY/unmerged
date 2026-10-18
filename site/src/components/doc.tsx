import type { ReactNode } from 'react';
import { Logo } from './ui';

/** A plain text page (privacy policy, support): a link home, a title, an optional date line, then sections. */
export function DocPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[680px] px-6 pt-10 pb-24">
      <a href="/" className="flex w-fit items-center gap-2 text-[15px] font-semibold tracking-tight">
        <Logo />
        Unmerged
      </a>
      <h1 className="mt-16 text-[34px] leading-[1.1] font-semibold tracking-[-0.03em]">{title}</h1>
      {updated && <p className="mt-3 text-[13px] text-subtle">Last updated {updated}</p>}
      {children}
    </div>
  );
}

/** The paragraph under a DocPage's title. */
export function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-[15px] leading-relaxed text-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-2">{children}</p>;
}

/** A heading and its prose; lists, links and code inside are styled here. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 space-y-4 text-[15px] leading-relaxed text-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-2 [&_b]:font-medium [&_b]:text-fg [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-fg/90 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-5">
      <h2 className="text-[19px] font-semibold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}
