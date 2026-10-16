/** `tier` is GitHub's "x2"/"x3"/"x4" label, `metal` its bronze/silver/gold styling. */
export type Achievement = { slug: string; name: string; image: string; tier: { label: string; metal: string | null } | null };

/**
 * A user's achievements. The API doesn't expose them, so they're read from github.com's achievements tab
 * (same origin, so it renders with the user's session, as GitHub would show it to them).
 */
export async function fetchAchievements(login: string): Promise<Achievement[]> {
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
