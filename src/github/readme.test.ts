import { describe, expect, it } from 'vitest';
import { absolutizeReadme } from './readme';

const RAW = 'https://raw.githubusercontent.com/o/r/HEAD/';
const BLOB = 'https://github.com/o/r/blob/HEAD/';

/** Absolutizes `html` for a README in `dir` and parses the result back. */
const absolutize = (html: string, dir?: string) => new DOMParser().parseFromString(absolutizeReadme(html, RAW, BLOB, dir), 'text/html');

/** The attribute `selector` ends up with after absolutizing `html`. */
const after = (html: string, selector: string, attr: string, dir?: string) => absolutize(html, dir).querySelector(selector)?.getAttribute(attr);

describe('absolutizeReadme', () => {
  it('points relative images at raw files and relative links at the blob view', () => {
    expect(after('<img src="docs/shot.png">', 'img', 'src')).toBe(`${RAW}docs/shot.png`);
    expect(after('<picture><source srcset="dark.png"></picture>', 'source', 'srcset')).toBe(`${RAW}dark.png`);
    expect(after('<a href="CONTRIBUTING.md">x</a>', 'a', 'href')).toBe(`${BLOB}CONTRIBUTING.md`);
  });

  it.each(['https://example.com/a.png', '//cdn.example.com/a.png', '#install', 'mailto:me@example.com'])('leaves %s alone', (url) => {
    expect(after(`<a href="${url}">x</a>`, 'a', 'href')).toBe(url);
  });

  it("resolves relative URLs against the README's folder and root-relative ones against the repo root", () => {
    expect(after('<img src="shot.png">', 'img', 'src', 'sub%20dir/')).toBe(`${RAW}sub%20dir/shot.png`);
    expect(after('<img src="/docs/b.png">', 'img', 'src', 'sub%20dir/')).toBe(`${RAW}docs/b.png`);
    expect(after('<a href="/LICENSE">x</a>', 'a', 'href', 'sub%20dir/')).toBe(`${BLOB}LICENSE`);
  });

  it('resolves every srcset candidate', () => {
    const srcset = 'a.png 1x, /b.png 2x, https://c.example/c.png 3x, data:image/png;base64,AA 4x';
    expect(after(`<img srcset="${srcset}">`, 'img', 'srcset', 'sub/')).toBe(
      `${RAW}sub/a.png 1x, ${RAW}b.png 2x, https://c.example/c.png 3x, data:image/png;base64,AA 4x`,
    );
  });

  it('turns a prefers-color-scheme picture into one theme-tagged image per scheme', () => {
    const doc = absolutize('<picture><source media="(prefers-color-scheme: dark)" srcset="dark.png"><img src="light.png" alt="logo"></picture>');
    expect(doc.querySelector('picture')).toBeNull();
    expect([...doc.querySelectorAll('img')].map((img) => [img.getAttribute('src'), img.getAttribute('alt')])).toEqual([
      [`${RAW}dark.png#gh-dark-mode-only`, 'logo'],
      [`${RAW}light.png#gh-light-mode-only`, 'logo'],
    ]);
  });

  it('leaves a picture without color-scheme sources alone', () => {
    expect(absolutize('<picture><source media="(min-width: 600px)" srcset="wide.png"><img src="a.png"></picture>').querySelector('picture')).not.toBeNull();
  });
});
