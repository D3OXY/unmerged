import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Download01Icon, File02Icon, HistoryIcon, Link02Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { usePageHotkey } from '@/app/keyboard';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { useIsDark } from '@/lib/settings';
import { onNavigate } from '@/lib/navigation';
import { formatBytes } from '@/lib/time';
import { Markdown, Panel, Skeleton } from '@/ui/primitives';
import { LoadError } from './LoadError';
import { CommitBar } from './TreeView';
import { repoMarkdownQuery, type LastCommit } from './query';
import { blameUrl, blobUrl, commitsUrl, rawUrl } from './urls';

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

/** [10, 20] → "#L10-L20"; [10, 10] → "#L10". */
const linesHash = ([a, b]: [number, number]) => (a === b ? `#L${a}` : `#L${a}-L${b}`);

type Props = { nameWithOwner: string; gitRef: string; path: string; blob: Blob; lastCommit?: LastCommit; commitOid?: string };

/**
 * A file: highlighted code with linkable lines, rendered Markdown, or an image. `commitOid` is the commit
 * `gitRef` pointed at when the file was read, for permalinks.
 */
export function BlobView({ nameWithOwner, gitRef, path, blob, lastCommit, commitOid }: Props) {
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

  const markdown = useQuery({ ...repoMarkdownQuery(nameWithOwner, gitRef, path), enabled: isMarkdown && preview });

  // The file at this commit, with the selected lines: unlike the branch URL, it keeps pointing at what's shown.
  const copyPermalink = useCallback(() => {
    if (commitOid) copy(`https://github.com${blobUrl(nameWithOwner, commitOid, path)}${selection ? linesHash(selection) : ''}`, 'permalink');
  }, [nameWithOwner, commitOid, path, selection]);
  usePageHotkey('y', copyPermalink);
  const commands = useMemo<Command[]>(
    () => [{ id: 'blob:permalink', group: 'File', title: 'Copy permalink', hint: 'Y', icon: <HugeiconsIcon icon={Link02Icon} />, perform: copyPermalink }],
    [copyPermalink],
  );
  useRegisterCommands('blob', commands);

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
    history.replaceState(history.state, '', linesHash(next));
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
          <Action href={blameUrl(nameWithOwner, gitRef, path)} icon={<HugeiconsIcon icon={UserGroupIcon} />} label="Blame" />
          <Action href={commitsUrl(nameWithOwner, gitRef, path)} icon={<HugeiconsIcon icon={HistoryIcon} />} label="History" />
          <Action href={raw} icon={<HugeiconsIcon icon={Download01Icon} />} label="Raw" />
          {blob.text !== null && (
            <button type="button" onClick={() => copy(blob.text!, 'file contents')} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 hover:bg-hover hover:text-fg">
              <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
              Copy
            </button>
          )}
          {commitOid && (
            <button type="button" onClick={copyPermalink} title="Copy a link to this version of the file and the selected lines (Y)" className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 hover:bg-hover hover:text-fg">
              <HugeiconsIcon icon={Link02Icon} className="size-3.5" />
              Permalink
            </button>
          )}
        </span>
      </div>

      {!showCode ? (
        <div className="px-8 py-6">
          {markdown.data ? (
            <Markdown html={markdown.data} />
          ) : markdown.error ? (
            <LoadError what="the preview" error={markdown.error} retry={markdown.refetch} />
          ) : (
            markdown.isPending && <Skeleton className="h-48" />
          )}
        </div>
      ) : blob.isBinary || blob.text === null ? (
        IMAGE.test(path) ? (
          <div className="flex justify-center bg-[repeating-conic-gradient(var(--u-elevated)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-8">
            <img src={raw} alt={path} className="max-h-[70vh] max-w-full" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-[13px] text-subtle">
            <HugeiconsIcon icon={File02Icon} className="size-6" />
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
