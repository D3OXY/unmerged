import { describe, expect, it } from 'vitest';
import { frameVideos, mediaAt } from './MediaViewer';

const IMG = 'https://camo.githubusercontent.com/abc';

/** `html` as Markdown renders it (videos framed), and the media a click on `selector` opens. */
function clickOn(html: string, selector: string) {
  const root = document.createElement('div');
  root.innerHTML = html;
  frameVideos(root);
  return mediaAt(root.querySelector(selector)!);
}

describe('mediaAt', () => {
  it("opens images GitHub links to themselves, and ones that aren't links", () => {
    expect(clickOn(`<a target="_blank" href="${IMG}"><img src="${IMG}" alt="Shot"></a>`, 'img')).toEqual({ kind: 'image', src: IMG, caption: 'Shot', href: IMG });
    expect(clickOn(`<img src="${IMG}" alt="">`, 'img')).toMatchObject({ kind: 'image', href: IMG });
  });

  it('leaves images the author linked somewhere (badges) to their link', () => {
    expect(clickOn(`<a href="https://example.com"><img src="${IMG}"></a>`, 'img')).toBeNull();
  });

  it("opens a video from its expand button, captioned with GitHub's file name", () => {
    const video = 'https://private-user-images.githubusercontent.com/1/demo.mp4?jwt=x';
    const html = `<details open><summary> demo.mp4 </summary><video src="${video}" controls></video></details>`;
    expect(clickOn(html, '.u-video > button')).toEqual({ kind: 'video', src: `${video}#t=0`, caption: 'demo.mp4', href: video });
    expect(clickOn(html, 'video')).toBeNull();
  });
});

describe('frameVideos', () => {
  it('puts a player under a paragraph that links to a video file elsewhere', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      '<p>▶ <a href="https://files.example.com/f/1/demo.mp4?t=x">Recording</a></p>',
      '<p><a href="https://github.com/o/r/blob/main/demo.mp4">demo.mp4</a> <a href="https://example.com/demo">page</a></p>',
    ].join('');
    frameVideos(root);
    expect(root.querySelectorAll('iframe')).toHaveLength(1);
    const player = root.querySelector('iframe')!;
    expect(player.previousElementSibling).toBe(root.querySelector('p'));
    expect(new URL(player.src).searchParams.get('src')).toBe('https://files.example.com/f/1/demo.mp4?t=x');
  });
});
