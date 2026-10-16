import { describe, expect, it } from 'vitest';
import { absolutizeReadme } from './readme';

const RAW = 'https://raw.githubusercontent.com/o/r/HEAD/';
const BLOB = 'https://github.com/o/r/blob/HEAD/';

/** The attribute `selector` ends up with after absolutizing `html`. */
const after = (html: string, selector: string, attr: string) =>
  new DOMParser().parseFromString(absolutizeReadme(html, RAW, BLOB), 'text/html').querySelector(selector)?.getAttribute(attr);

describe('absolutizeReadme', () => {
  it('points relative images at raw files and relative links at the blob view', () => {
    expect(after('<img src="docs/shot.png">', 'img', 'src')).toBe(`${RAW}docs/shot.png`);
    expect(after('<picture><source srcset="dark.png"></picture>', 'source', 'srcset')).toBe(`${RAW}dark.png`);
    expect(after('<a href="CONTRIBUTING.md">x</a>', 'a', 'href')).toBe(`${BLOB}CONTRIBUTING.md`);
  });

  it.each(['https://example.com/a.png', '//cdn.example.com/a.png', '#install', 'mailto:me@example.com'])('leaves %s alone', (url) => {
    expect(after(`<a href="${url}">x</a>`, 'a', 'href')).toBe(url);
  });
});
