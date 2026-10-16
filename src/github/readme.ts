/**
 * README HTML from the API keeps URLs as written. Point images at `rawRoot` and links at `blobRoot` (the
 * repo's raw and blob URLs at a ref, ending in "/") so they work outside the page GitHub would render them on.
 * Relative URLs resolve against `dir`, the README's folder (encoded, ending in "/"); root-relative ones
 * against the repo root, as on GitHub.
 */
export function absolutizeReadme(html: string, rawRoot: string, blobRoot: string, dir = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const resolve = (url: string, root: string) => (/^([a-z][a-z\d+.-]*:|\/\/|#)/i.test(url) ? url : url.startsWith('/') ? root + url.slice(1) : root + dir + url);
  for (const img of doc.querySelectorAll('img[src]')) {
    img.setAttribute('src', resolve(img.getAttribute('src')!, rawRoot));
  }
  // Every candidate: "a.png 1x, b.png 2x".
  for (const el of doc.querySelectorAll('[srcset]')) {
    el.setAttribute('srcset', el.getAttribute('srcset')!.replace(/(^|,)(\s*)(\S+)/g, (_, comma, space, url) => comma + space + resolve(url, rawRoot)));
  }
  for (const link of doc.querySelectorAll('a[href]')) {
    link.setAttribute('href', resolve(link.getAttribute('href')!, blobRoot));
  }
  for (const picture of doc.querySelectorAll('picture')) splitThemedPicture(picture);
  return doc.body.innerHTML;
}

/**
 * `<source media="(prefers-color-scheme: dark)">` follows the OS, not Unmerged's theme. Turns such a picture
 * into one image per scheme, tagged like GitHub's `#gh-dark-mode-only` images, which style.css shows by theme.
 * The fallback `<img>` stands in for whichever scheme has no source.
 */
function splitThemedPicture(picture: Element) {
  const img = picture.querySelector('img');
  const themed = new Map<string, string>();
  for (const source of picture.querySelectorAll('source')) {
    const scheme = source.getAttribute('media')?.match(/prefers-color-scheme:\s*(dark|light)/)?.[1];
    const url = source.getAttribute('srcset')?.trim().split(/\s+/)[0];
    if (scheme && url && !themed.has(scheme)) themed.set(scheme, url);
  }
  if (!img || !themed.size) return;
  const fallback = img.getAttribute('src');
  if (themed.size === 1 && fallback) themed.set(themed.has('dark') ? 'light' : 'dark', fallback);
  picture.replaceWith(
    ...[...themed].map(([scheme, url]) => {
      const variant = img.cloneNode() as Element;
      variant.removeAttribute('srcset');
      variant.setAttribute('src', `${url}#gh-${scheme}-mode-only`);
      return variant;
    }),
  );
}
