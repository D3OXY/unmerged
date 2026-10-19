import { describe, expect, it } from 'vitest';
import { lazyImages } from './primitives';

/** `html` after the pass, as the page parses it. */
function render(html: string) {
  const root = document.createElement('div');
  root.innerHTML = lazyImages(html);
  return root;
}

describe('lazyImages', () => {
  it('makes every image lazy and async, and keeps its own attributes', () => {
    const root = render('<p><img width="1186" alt="Shot" src="https://a/1.png"></p><picture><source srcset="https://a/2.png"><IMG src="https://a/3.png"/></picture><img/src="https://a/4.png">');
    const images = [...root.querySelectorAll('img')];
    expect(images.map((img) => [img.getAttribute('loading'), img.getAttribute('decoding')])).toEqual(Array(3).fill(['lazy', 'async']));
    expect(images[0]?.getAttribute('width')).toBe('1186');
    expect(images[0]?.alt).toBe('Shot');
    expect(images.map((img) => img.getAttribute('src'))).toEqual(['https://a/1.png', 'https://a/3.png', 'https://a/4.png']);
  });

  it('changes only image tags: escaped text, other tags and attribute values keep their meaning', () => {
    const text = '<p>&lt;img src=x&gt; <imgx></imgx></p>';
    expect(lazyImages(text)).toBe(text);
    const link = render('<a title="<img src=x>" href="#">a</a>').querySelector('a')!;
    expect(link.title).toBe('<img loading=lazy decoding=async  src=x>');
    expect(link.getAttributeNames()).toEqual(['title', 'href']);
  });
});
