export type DiffLine = { type: 'add' | 'del' | 'ctx'; old?: number; new?: number; text: string };
export type Hunk = { header: string; lines: DiffLine[] };

/** Parses a unified-diff patch (as returned per file by GitHub's REST API) into hunks with line numbers. */
export function parsePatch(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  let hunk: Hunk | undefined;
  let oldNo = 0;
  let newNo = 0;
  for (const raw of patch.split('\n')) {
    const header = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) {
      oldNo = Number(header[1]);
      newNo = Number(header[2]);
      hunk = { header: raw, lines: [] };
      hunks.push(hunk);
    } else if (hunk && !raw.startsWith('\\')) {
      const text = raw.slice(1);
      if (raw[0] === '+') hunk.lines.push({ type: 'add', new: newNo++, text });
      else if (raw[0] === '-') hunk.lines.push({ type: 'del', old: oldNo++, text });
      else hunk.lines.push({ type: 'ctx', old: oldNo++, new: newNo++, text });
    }
  }
  return hunks;
}

export type SplitRow = { left?: DiffLine; right?: DiffLine };

/** Pairs a hunk's lines side by side: each run of deletions lines up with the additions that follow it. */
export function splitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.type === 'ctx') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (lines[i]?.type === 'del') dels.push(lines[i++]!);
    while (lines[i]?.type === 'add') adds.push(lines[i++]!);
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) rows.push({ left: dels[k], right: adds[k] });
  }
  return rows;
}
