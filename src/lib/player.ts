/**
 * Linked videos (a Markdown link to an .mp4, .webm or .mov file elsewhere) play in an extension page framed
 * into ours: github.com's CSP only lets the page itself load media from GitHub's hosts.
 */

/** What the player page posts to github.com: its expand button, or Escape while it's the full view. */
export type PlayerMessage = { type: 'expand'; src: string; title: string; time: number } | { type: 'close' };

/** The player page for `src`. `full` is the media viewer's: it starts playing at `time` and has no expand button. */
export function playerUrl(src: string, title: string, full?: { time: number }) {
  const params = new URLSearchParams({ src, title });
  if (full) params.set('time', String(full.time));
  return `${browser.runtime.getURL('/player.html')}?${params}`;
}

/** Whether a link points at a video file the player can show (GitHub's own uploads render as <video>). */
export function isVideoLink(url: URL) {
  return url.protocol === 'https:' && url.hostname !== 'github.com' && /\.(mp4|webm|mov)$/i.test(url.pathname);
}
