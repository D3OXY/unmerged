import { useEffect, type MouseEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { isModifiedClick } from '@/lib/navigation';
import { isVideoLink, playerUrl, type PlayerMessage } from '@/lib/player';
import { createStore } from '@/lib/store';
import { Overlay } from './Modal';

/** `player` is a linked video: `src` is the player page (src/lib/player.ts), `href` the video. */
type Media = { kind: 'image' | 'video' | 'player'; src: string; caption: string; href: string };

/** What the viewer shows; null while it's closed. */
const viewedMedia = createStore<Media | null>(null);

/** An image or video from Markdown, as large as the window allows, over a dark page (like Discord's). */
export function MediaViewer() {
  const media = viewedMedia.use();
  useEffect(() => {
    const origin = new URL(browser.runtime.getURL('/')).origin;
    const onMessage = ({ origin: from, data }: MessageEvent<PlayerMessage>) => {
      if (from !== origin) return;
      if (data.type === 'close') return viewedMedia.set(null);
      viewedMedia.set({ kind: 'player', src: playerUrl(data.src, data.title, { time: data.time }), caption: data.title, href: data.src });
    };
    addEventListener('message', onMessage);
    return () => removeEventListener('message', onMessage);
  }, []);
  if (!media) return null;
  const close = () => viewedMedia.set(null);
  // Images show at most their own size; videos (often small phone recordings) fill the window's height.
  const fit = 'max-h-[calc(100vh-112px)] max-w-[calc(100vw-64px)] rounded-lg shadow-2xl shadow-black/60';

  return (
    <Overlay label={media.caption || (media.kind === 'image' ? 'Image' : 'Video')} onClose={close} className="items-center bg-black/85 p-8" panelClassName="flex animate-pop flex-col items-center gap-3">
      {media.kind === 'image' && <img src={media.src} alt={media.caption} className={`${fit} object-contain`} />}
      {media.kind === 'video' && <video src={media.src} controls autoPlay className={`${fit} h-[calc(100vh-112px)] bg-black`} />}
      {media.kind === 'player' && (
        <iframe
          src={media.src}
          title={media.caption || 'Video'}
          allow="autoplay; fullscreen"
          className={`${fit} aspect-video w-[min(calc(100vw-64px),calc((100vh-112px)*16/9))] bg-black`}
        />
      )}
      <div className="flex max-w-[calc(100vw-64px)] items-center gap-3 text-[12.5px] text-white/60">
        {media.caption && <span className="truncate">{media.caption}</span>}
        <a href={media.href} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 hover:text-white">
          Open original
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5" />
        </a>
        <button type="button" onClick={close} aria-label="Close" className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-white/10 hover:text-white">
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </Overlay>
  );
}

/**
 * The media a click in rendered Markdown opens: an image that isn't a link of its own (GitHub wraps images in a
 * `target="_blank"` link to themselves; links the author wrote have no target), or the video behind an expand
 * button added by `frameVideos`. A video picks up where the inline one is (`#t=`).
 */
export function mediaAt(target: Element): Media | null {
  const video = target.closest('.u-video > button')?.previousElementSibling;
  if (video instanceof HTMLVideoElement) {
    const src = video.currentSrc || video.src;
    const caption = video.closest('details')?.querySelector('summary')?.textContent?.trim() ?? '';
    return { kind: 'video', src: `${src}#t=${video.currentTime}`, caption, href: src };
  }
  const img = target.closest('img');
  const link = img?.closest('a');
  if (!img || (link && link.target !== '_blank')) return null;
  return { kind: 'image', src: img.currentSrc || img.src, caption: img.alt, href: link?.href ?? img.src };
}

/** `Markdown`'s click handler: opens images and videos in the viewer instead of a new tab. */
export function openMedia(event: MouseEvent) {
  if (!(event.target instanceof Element) || isModifiedClick(event.nativeEvent)) return;
  const media = mediaAt(event.target);
  if (!media) return;
  event.preventDefault();
  if (media.kind === 'video') event.target.closest('.u-video')?.querySelector('video')?.pause();
  viewedMedia.set(media);
}

/**
 * Wraps each video under `root` in a frame with an expand button, for `openMedia` to catch, and puts a player
 * under each link to a video file (below its paragraph, so the text reads as its title).
 */
export function frameVideos(root: HTMLElement) {
  for (const link of root.querySelectorAll('a')) {
    const url = URL.parse(link.href);
    if (!url || !isVideoLink(url)) continue;
    const player = document.createElement('iframe');
    player.className = 'u-player';
    player.title = link.textContent.trim() || 'Video';
    player.allow = 'fullscreen';
    player.src = playerUrl(url.href, player.title);
    (link.closest('p') ?? link).after(player);
  }
  for (const video of root.querySelectorAll('video')) {
    const frame = document.createElement('div');
    frame.className = 'u-video';
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.title = 'Open full view';
    expand.setAttribute('aria-label', expand.title);
    video.replaceWith(frame);
    frame.append(video, expand);
  }
}
