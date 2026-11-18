/**
 * A job in a workflow file, as the run graph needs it. `name` is the `name:` as written (with its `${{ }}`), or
 * undefined when the job has none (GitHub then shows its id). `uses`: it calls a reusable workflow.
 */
export type WorkflowJob = { id: string; name?: string; needs: string[]; uses: boolean };

/**
 * The jobs in a workflow file, in file order, or null when it has no `jobs:`. Not a YAML parser: it reads
 * only the job ids and their `name`, `needs` and `uses`, which is all the graph draws, and
 * keeps a full YAML library out of the app. Workflows are block YAML in practice; this reads that.
 */
export function parseWorkflowJobs(text: string): WorkflowJob[] | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^jobs:\s*(#.*)?$/.test(line));
  if (start === -1) return null;

  const jobs: WorkflowJob[] = [];
  let jobIndent = -1;
  let propIndent = -1;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!isContent(line)) continue;
    const indent = indentOf(line);
    if (indent === 0) break; // The next top-level key.
    if (jobIndent === -1) jobIndent = indent;
    if (indent === jobIndent) {
      const id = /^\s*(["']?)([\w-]+)\1:\s*(#.*)?$/.exec(line)?.[2];
      if (id) jobs.push({ id, needs: [], uses: false });
      propIndent = -1;
      continue;
    }
    const job = jobs.at(-1);
    if (!job || indent < jobIndent) continue;
    if (propIndent === -1) propIndent = indent;
    if (indent !== propIndent) continue;

    const [, key, inline = ''] = /^\s*([\w-]+):(?:\s+(.*))?$/.exec(line) ?? [];
    // The property's value goes on over every following line indented deeper than the property, and a block
    // list may start at the property's own indent.
    const block: string[] = [];
    const goesOn = (next: string) => !isContent(next) || indentOf(next) > propIndent || (indentOf(next) === propIndent && /^\s*-\s/.test(next));
    while (i + 1 < lines.length && goesOn(lines[i + 1] ?? '')) block.push(lines[++i] ?? '');
    if (key === 'name') job.name = scalar(inline);
    else if (key === 'needs') job.needs = list(inline, block);
    else if (key === 'uses') job.uses = true;
  }
  return jobs;
}

const indentOf = (line: string) => line.length - line.trimStart().length;
const isContent = (line: string) => !/^\s*(#|$)/.test(line);

/** A plain or quoted scalar, without a trailing comment. Undefined for a block scalar (`|`, `>`). */
function scalar(raw: string): string | undefined {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value.slice(0, value.lastIndexOf('"') + 1)) as string;
    } catch {
      return undefined;
    }
  }
  if (value.startsWith("'")) return value.slice(1, value.lastIndexOf("'")).replace(/''/g, "'");
  if (/^[|>]/.test(value)) return undefined;
  return value.replace(/\s+#.*$/, '');
}

/** `needs:` in any of its forms: one id, a flow list (also over several lines), or a block list. */
function list(inline: string, block: string[]): string[] {
  const text = [inline, ...block].map((line) => line.replace(/(^|\s)#.*$/, '')).join(' ').trim();
  if (text.startsWith('[')) return text.slice(1, text.lastIndexOf(']')).split(',').flatMap((item) => scalar(item) || []);
  if (text.startsWith('-')) return block.flatMap((line) => (/^\s*-\s/.test(line) ? scalar(line.trim().slice(1)) || [] : []));
  const id = scalar(text);
  return id ? [id] : [];
}
