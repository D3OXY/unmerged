import { browser } from '#imports';

let loaded = false;

/**
 * Registers our fonts (Geist, Geist Mono, and JetBrains Mono for the Mono font setting) with the page's
 * FontFaceSet, once, when our UI first mounts (so pages we leave alone never download them). Loading from
 * bytes (not a URL) sidesteps GitHub's font-src CSP, and fonts on `document.fonts` are visible inside our
 * shadow root.
 */
export async function loadFonts() {
  if (loaded) return;
  loaded = true;
  const faces = [
    ['Geist', '/fonts/geist.woff2', '100 900'],
    ['Geist Mono', '/fonts/geist-mono.woff2', '100 900'],
    ['JetBrains Mono', '/fonts/jetbrains-mono.woff2', '100 800'],
  ] as const;
  await Promise.all(
    faces.map(async ([family, path, weight]) => {
      const bytes = await fetch(browser.runtime.getURL(path)).then((r) => r.arrayBuffer());
      const face = new FontFace(family, bytes, { weight, display: 'swap' });
      document.fonts.add(await face.load());
    }),
  );
}
