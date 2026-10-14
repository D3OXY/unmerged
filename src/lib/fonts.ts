import { browser } from '#imports';

/**
 * Registers Geist with the page's FontFaceSet. Loading from bytes (not a URL) sidesteps GitHub's
 * font-src CSP, and fonts on `document.fonts` are visible inside our shadow root.
 */
export async function loadFonts() {
  const faces = [
    ['Geist', '/fonts/geist.woff2'],
    ['Geist Mono', '/fonts/geist-mono.woff2'],
  ] as const;
  await Promise.all(
    faces.map(async ([family, path]) => {
      const bytes = await fetch(browser.runtime.getURL(path)).then((r) => r.arrayBuffer());
      const face = new FontFace(family, bytes, { weight: '100 900', display: 'swap' });
      document.fonts.add(await face.load());
    }),
  );
}
