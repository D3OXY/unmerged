import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download, FileText, History, Users } from 'lucide-react';
import { restHtml } from '@/github/client';
import { absolutizeReadme } from '@/github/readme';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { useIsDark } from '@/lib/settings';
import { onNavigate } from '@/lib/navigation';
import { Markdown, Panel, Skeleton } from '@/ui/primitives';
import { CommitBar } from './TreeView';
import type { LastCommit } from './query';
import { blobUrl, commitsUrl, rawUrl } from './urls';

type Blob = { oid: string; byteSize: number; isBinary: boolean | null; isTruncated: boolean; text: string | null };

const MAX_LINES = 5000;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|ico|avif|bmp)$/i;
const MARKDOWN = /\.(md|markdown|mdx)$/i;

/** "#L10" or "#L10-L20" → [10, 20]. */
function parseLines(hash: string): [number, number] | null {
  const m = hash.match(/^#L(\d+)(?:-L(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2] ?? m[1]);
  return [Math.min(a, b), Math.max(a, b)];
}

/** A file: highlighted code with linkable lines, rendered Markdown, or an image. */
export function BlobView({ nameWithOwner, gitRef, path, blob, lastCommit }: { nameWithOwner: string; gitRef: string; path: string; blob: Blob; lastCommit?: LastCommit }) {
  const isMarkdown = MARKDOWN.test(path);
  const [preview, setPreview] = useState(isMarkdown);
  const [selection, setSelection] = useState(() => parseLines(location.hash));
  const lines = useMemo(() => (blob.text ?? '').replace(/\n$/, '').split('\n'), [blob.text]);
  const dark = useIsDark();
  // Plain text first; highlighting arrives with the code renderer (usually already loaded, see RepoPage).
  const highlighted = useQuery({
    queryKey: ['highlight', blob.oid, path, dark],
    queryFn: async () => (await loadDiffs()).highlightLines(lines.slice(0, MAX_LINES).join('\n'), path, dark),
    enabled: !isMarkdown || !preview,
    staleTime: Infinity,
  });
  const raw = rawUrl(nameWithOwner, gitRef, path);
  const tableRef = useRef<HTMLTableElement>(null);

  const markdown = useQuery({
    queryKey: ['repo-markdown', nameWithOwner, gitRef, path],
    enabled: isMarkdown && preview,
    queryFn: async () => {
      const html = await restHtml(`/repos/${nameWithOwner}/contents/${path}?ref=${encodeURIComponent(gitRef)}`);
      const dir = path.split('/').slice(0, -1).join('/');
      const base = dir ? `${dir}/` : '';
      return html && absolutizeReadme(html, rawUrl(nameWithOwner, gitRef, base), `https://github.com${blobUrl(nameWithOwner, gitRef, base)}`);
    },
    staleTime: 5 * 60_000,
  });

  // Keep the highlighted range in sync with #L links (ours or pasted).
  useEffect(() => onNavigate(() => setSelection(parseLines(location.hash))), []);
  // Scroll to a linked line on arrival only; clicking line numbers shouldn't jump the page.
  const initialSelection = useRef(selection);
  useEffect(() => {
    const start = initialSelection.current?.[0];
    if (start) tableRef.current?.querySelector(`#L${start}`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, []);

  const selectLine = (n: number, extend: boolean) => {
    const next: [number, number] = extend && selection ? [Math.min(selection[0], n), Math.max(selection[0], n)] : [n, n];
    setSelection(next);
    history.replaceState(history.state, '', next[0] === next[1] ? `#L${next[0]}` : `#L${next[0]}-L${next[1]}`);
  };

  const showCode = !(isMarkdown && preview);

  return (
    <Panel className="overflow-hidden">
      {lastCommit && <CommitBar nameWithOwner={nameWithOwner} gitRef={gitRef} path={path} commit={lastCommit} />}
      <div className="flex h-11 items-center gap-3 border-b border-line px-4 text-[12px] text-muted">
        {isMarkdown && (
          <div className="flex rounded-lg border border-line bg-bg p-0.5">
            {(['Preview', 'Code'] as const).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setPreview(label === 'Preview')}
                className={cx('h-6 cursor-pointer rounded-md px-2.5 text-[12px]', (label === 'Preview') === preview ? 'bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {blob.text !== null && <span className="tabular-nums">{lines.length.toLocaleString()} lines</span>}
        <span className="tabular-nums">{formatBytes(blob.byteSize)}</span>
        <span className="ml-auto flex items-center gap-1">
          <Action href={`/${nameWithOwner}/blame/${gitRef}/${path}`} icon={<Users />} label="Blame" />
          <Action href={commitsUrl(nameWithOwner, gitRef, path)} icon={<History />} label="History" />
          <Action href={raw} icon={<Download />} label="Raw" />
          {blob.text !== null && (
            <button type="button" onClick={() => copy(blob.text!, 'file contents')} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 hover:bg-hover hover:text-fg">
              <Copy className="size-3.5" />
              Copy
            </button>
          )}
        </span>
      </div>

      {!showCode ? (
        <div className="px-8 py-6">{markdown.isPending ? <Skeleton className="h-48" /> : markdown.data && <Markdown html={markdown.data} />}</div>
      ) : blob.isBinary || blob.text === null ? (
        IMAGE.test(path) ? (
          <div className="flex justify-center bg-[repeating-conic-gradient(var(--u-elevated)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-8">
            <img src={raw} alt={path} className="max-h-[70vh] max-w-full" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-[13px] text-subtle">
            <FileText className="size-6" />
            {blob.isBinary ? 'Binary file not shown.' : 'File too large to display.'}
            <a href={raw} className="text-accent hover:underline">
              View raw
            </a>
          </div>
        )
      ) : (
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full border-collapse font-mono text-[12px] leading-5">
            <tbody>
              {lines.slice(0, MAX_LINES).map((line, i) => {
                const n = i + 1;
                const selected = selection && n >= selection[0] && n <= selection[1];
                return (
                  <tr key={n} id={`L${n}`} className={cx(selected && 'bg-warning/12')}>
                    <td
                      onClick={(e) => selectLine(n, e.shiftKey)}
                      className={cx('w-12 cursor-pointer px-3 text-right align-top text-[11px] text-subtle tabular-nums select-none hover:text-fg', selected && 'text-fg')}
                    >
                      {n}
                    </td>
                    {highlighted.data ? (
                      <td className="px-3 whitespace-pre [tab-size:4]" dangerouslySetInnerHTML={{ __html: highlighted.data[i] || ' ' }} />
                    ) : (
                      <td className="px-3 whitespace-pre [tab-size:4]">{line || ' '}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lines.length > MAX_LINES && (
            <div className="border-t border-line px-4 py-3 text-center text-[12.5px] text-subtle">
              Showing the first {MAX_LINES.toLocaleString()} lines.{' '}
              <a href={raw} className="text-accent hover:underline">
                View raw
              </a>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function Action({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a href={href} className="flex h-7 items-center gap-1.5 rounded-md px-2 hover:bg-hover hover:text-fg [&>svg]:size-3.5">
      {icon}
      {label}
    </a>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
