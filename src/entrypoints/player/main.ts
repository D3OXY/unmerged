import type { PlayerMessage } from '@/lib/player';

const params = new URLSearchParams(location.search);
const src = params.get('src') ?? '';
const time = params.get('time');
const video = document.querySelector('video')!;
const expand = document.querySelector('button')!;
const post = (message: PlayerMessage) => parent.postMessage(message, 'https://github.com');

if (time === null) {
  // Inline: nothing loads from the video's host until it's played.
  expand.hidden = false;
  expand.addEventListener('click', () => {
    video.pause();
    post({ type: 'expand', src, title: params.get('title') ?? '', time: video.currentTime });
  });
} else {
  // The media viewer: play from where the inline player was. Escape here never reaches the viewer, so pass it on.
  video.autoplay = true;
  addEventListener('keydown', (e) => e.key === 'Escape' && post({ type: 'close' }));
}
if (src.startsWith('https://')) video.src = time ? `${src}#t=${time}` : src;
