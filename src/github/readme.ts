/**
 * README HTML from the API keeps repo-relative URLs. Point images at `rawBase` and links at `blobBase`
 * (both ending in "/") so they work outside the repo page GitHub would render them on.
 */
export function absolutizeReadme(html: string, rawBase: string, blobBase: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const isRelative = (url: string) => !/^([a-z]+:|\/\/|#|\/)/i.test(url);
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src')!;
    if (isRelative(src)) img.setAttribute('src', rawBase + src);
  }
  for (const source of doc.querySelectorAll('source[srcset]')) {
    const srcset = source.getAttribute('srcset')!;
    if (isRelative(srcset)) source.setAttribute('srcset', rawBase + srcset);
  }
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href')!;
    if (isRelative(href)) link.setAttribute('href', blobBase + href);
  }
  return doc.body.innerHTML;
}
