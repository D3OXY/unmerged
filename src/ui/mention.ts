/** An @mention being typed: where its "@" is, and the login typed after it so far. */
export type Mention = { start: number; query: string };

/**
 * The @mention that ends at `caret`, if any. Like GitHub, an "@" starts one only at the start of the text or
 * after a space or an opening bracket, so an email address (me@host) doesn't.
 */
export function mentionAt(text: string, caret: number): Mention | null {
  const match = /(?:^|[\s([{])@([A-Za-z0-9-]*)$/.exec(text.slice(0, caret));
  return match ? { start: caret - match[1]!.length - 1, query: match[1]! } : null;
}

/** `text` with the mention at `caret` completed to `@login `, and where the caret goes after it. */
export function completeMention(text: string, caret: number, mention: Mention, login: string) {
  const inserted = `@${login} `;
  // A space already after the caret is kept, not doubled.
  const after = text.slice(caret).replace(/^ /, '');
  return { text: `${text.slice(0, mention.start)}${inserted}${after}`, caret: mention.start + inserted.length };
}

// What the caret's position depends on: the textarea's box and text layout.
const COPIED = [
  'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight',
  'paddingBottom', 'paddingLeft', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'tabSize',
  'textTransform', 'wordSpacing', 'textIndent',
] as const;

/**
 * Where the caret at `index` is drawn, in viewport pixels: its left edge and its line's top and bottom. A hidden
 * copy of the textarea, with the text up to the caret, shows where the text wraps.
 */
export function caretPoint(textarea: HTMLTextAreaElement, index: number) {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const property of COPIED) mirror.style[property] = style[property];
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '0', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
  mirror.textContent = textarea.value.slice(0, index);
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.append(marker);
  textarea.parentNode!.append(mirror);
  const rect = textarea.getBoundingClientRect();
  // The marker's offsets start inside the mirror's border, as the textarea's text does inside its own.
  const top = rect.top + textarea.clientTop + marker.offsetTop - textarea.scrollTop;
  const point = { left: rect.left + textarea.clientLeft + marker.offsetLeft - textarea.scrollLeft, top, bottom: top + marker.offsetHeight };
  mirror.remove();
  return point;
}
