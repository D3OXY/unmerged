import type { PrFile } from './FileDiff';

/** GitHub's per-file `patch` is bare hunks; the renderer needs a git header to know the names and kind of change. */
export function gitPatch(file: PrFile, patch: string) {
  const old = file.previous_filename ?? file.filename;
  const header = [`diff --git a/${old} b/${file.filename}`];
  if (file.status === 'added') header.push('new file mode 100644', '--- /dev/null', `+++ b/${file.filename}`);
  else if (file.status === 'removed') header.push('deleted file mode 100644', `--- a/${old}`, '+++ /dev/null');
  else {
    if (file.previous_filename) header.push(`rename from ${old}`, `rename to ${file.filename}`);
    header.push(`--- a/${old}`, `+++ b/${file.filename}`);
  }
  return `${header.join('\n')}\n${patch}`;
}

/**
 * The old version of a file, rebuilt from its new version and the patch between them: outside the hunks
 * the two are identical, and inside them the patch has every old line. Saves finding and fetching the
 * merge base when someone expands unchanged lines.
 */
export function oldContents(newText: string, patch: string) {
  const next = newText.split('\n');
  const old: string[] = [];
  let copied = 0; // new-file lines accounted for so far
  const copyUntil = (line: number) => {
    while (copied < line) old.push(next[copied++] ?? '');
  };
  for (const raw of patch.split('\n')) {
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      const start = Number(hunk[1]);
      // `+5,3` starts at new line 5; an empty new side (`+5,0`) sits after line 5.
      copyUntil(hunk[2] === '0' ? start : start - 1);
    } else if (raw[0] === '-') old.push(raw.slice(1));
    else if (raw[0] === ' ') {
      old.push(raw.slice(1));
      copied++;
    } else if (raw[0] === '+') copied++;
  }
  copyUntil(next.length);
  return old.join('\n');
}

/** New-file lines `start`–`end` (1-based) as the patch shows them, or null when some fall outside its hunks. */
export function newLines(patch: string, start: number, end: number) {
  const lines: string[] = [];
  let line = 0;
  for (const raw of patch.split('\n')) {
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) line = Number(hunk[1]);
    else if (raw[0] === ' ' || raw[0] === '+') {
      if (line >= start && line <= end) lines.push(raw.slice(1));
      line++;
    }
  }
  return lines.length === end - start + 1 ? lines : null;
}
