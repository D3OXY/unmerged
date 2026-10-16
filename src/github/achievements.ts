import { queryOptions } from '@tanstack/react-query';
import { persisted } from '@/lib/persist';

// The API doesn't expose achievements, so they're read from github.com's own pages. Same origin, so they
// render with the user's session, as GitHub would show them.

/** `tier` is GitHub's "x2"/"x3"/"x4" label, `metal` its bronze/silver/gold styling. */
export type Achievement = { slug: string; name: string; image: string; tier: { label: string; metal: string | null } | null };

/** One run of a history line: plain text, or a link to a github.com path. */
export type HistoryPart = { text: string; href?: string };

export type AchievementDetail = {
  description: string;
  /** Art behind the badge in GitHub's dialog. */
  backdrop: string | null;
  /** Badge art for each tier, lowest first. */
  tiers: string[];
  unlocked: { label: string; at: string } | null;
  /** What earned it: one line per pull request, commit, etc. */
  history: HistoryPart[][];
};

export const achievementsQuery = (login: string) =>
  queryOptions({
    queryKey: ['achievements', login.toLowerCase()],
    queryFn: () => fetchAchievements(login),
    staleTime: 60 * 60_000,
    persister: persisted,
  });

export const achievementDetailQuery = (login: string, slug: string) =>
  queryOptions({
    queryKey: ['achievement', login.toLowerCase(), slug],
    queryFn: () => fetchAchievementDetail(login, slug),
    staleTime: 60 * 60_000,
    persister: persisted,
  });

async function fetchAchievements(login: string): Promise<Achievement[]> {
  const res = await fetch(`/${encodeURIComponent(login)}?tab=achievements`);
  if (!res.ok) return [];
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  return [...doc.querySelectorAll<HTMLElement>('[data-achievement-slug]')].flatMap((card) => {
    const img = card.querySelector<HTMLImageElement>('img.achievement-badge-card');
    if (!img) return [];
    const tier = card.querySelector('.achievement-tier-label');
    const label = tier?.textContent?.trim();
    return {
      slug: card.dataset.achievementSlug ?? '',
      name: card.querySelector('h3')?.textContent?.trim() || img.alt.replace(/^Achievement:\s*/, ''),
      image: img.src,
      tier: label ? { label, metal: tier?.className.match(/achievement-tier-label--(\w+)/)?.[1] ?? null } : null,
    };
  });
}

async function fetchAchievementDetail(login: string, slug: string): Promise<AchievementDetail> {
  // GitHub only serves this fragment to XHR requests (its dialog loads it that way).
  const res = await fetch(`/users/${encodeURIComponent(login)}/achievements/${encodeURIComponent(slug)}/detail`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const unlockedAt = doc.querySelector('.achievement-history-unlocked-at relative-time')?.getAttribute('datetime');
  return {
    description: doc.querySelector('h3')?.parentElement?.nextElementSibling?.textContent?.trim() ?? '',
    backdrop: doc.querySelector('[style*="background-image"]')?.getAttribute('style')?.match(/url\(['"]?([^'")]+)/)?.[1] ?? null,
    tiers: [...doc.querySelectorAll<HTMLImageElement>('img.tier-badge')].map((img) => img.src),
    unlocked: unlockedAt
      ? { label: doc.querySelector('.achievement-history-unlocked-at')?.textContent?.includes('First unlocked') ? 'First unlocked' : 'Unlocked', at: unlockedAt }
      : null,
    history: [...doc.querySelectorAll('.achievement-history-tier .TimelineItem-body')].map((line) => trim(parts(line))),
  };
}

/** Flattens markup into text and links, dropping everything else (classes, hovercards, icons). */
function parts(node: Node): HistoryPart[] {
  return [...node.childNodes].flatMap((child): HistoryPart[] => {
    const text = (child.textContent ?? '').replace(/\s+/g, ' ');
    if (child instanceof HTMLAnchorElement) {
      const href = child.getAttribute('href') ?? '';
      return [href.startsWith('/') ? { text, href } : { text }];
    }
    return child.nodeType === Node.TEXT_NODE ? [{ text }] : parts(child);
  });
}

function trim(line: HistoryPart[]) {
  const [first] = line;
  const last = line.at(-1);
  if (first) first.text = first.text.trimStart();
  if (last) last.text = last.text.trimEnd();
  return line.filter((part) => part.text);
}
