import { useState, type ReactNode, type Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { renderMarkdown } from '@/github/client';
import { cx } from '@/lib/cx';
import { Markdown, Skeleton } from './primitives';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** ⌘↵ / Ctrl+↵. */
  onSubmit: () => void;
  /** Esc, only while the box is empty, so a half-written comment is never thrown away. */
  onClose?: () => void;
  placeholder: string;
  rows?: number;
  autoFocus?: boolean;
  textareaRef?: Ref<HTMLTextAreaElement>;
  /** "owner/repo" the comment goes to: adds a Preview tab that renders the text as GitHub will, references and all. */
  preview?: string;
  className?: string;
  /** The action bar under the text. */
  children: ReactNode;
};

/** The box every comment is written in (conversation, thread replies, line comments): multi-line Markdown with an action bar. */
export function CommentBox({ value, onChange, onSubmit, onClose, placeholder, rows = 3, autoFocus, textareaRef, preview, className, children }: Props) {
  const [previewing, setPreviewing] = useState(false);
  const showPreview = previewing && !!preview;
  return (
    <div className={cx('rounded-xl border border-line bg-panel focus-within:border-line-strong', className)}>
      {preview && (
        <div className="flex gap-1 px-2 pt-2" role="tablist">
          {(['Write', 'Preview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={(tab === 'Preview') === previewing}
              onClick={() => setPreviewing(tab === 'Preview')}
              className={cx(
                'h-6 cursor-pointer rounded-md px-2 text-[12px]',
                (tab === 'Preview') === previewing ? 'bg-hover font-medium text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
      {showPreview ? (
        <MarkdownPreview text={value} context={preview} minHeight={rows * 22 + 20} />
      ) : (
        <textarea
          ref={textareaRef}
          autoFocus={autoFocus}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit();
            } else if (e.key === 'Escape' && onClose && !value.trim()) {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={placeholder}
          className="block w-full resize-y bg-transparent px-3.5 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-subtle"
        />
      )}
      <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">{children}</div>
    </div>
  );
}

/** The text as GitHub renders it. Asked for only while the Preview tab is open, once per distinct text. */
function MarkdownPreview({ text, context, minHeight }: { text: string; context: string; minHeight: number }) {
  const html = useQuery({
    queryKey: ['markdown-preview', context, text],
    queryFn: ({ signal }) => renderMarkdown(text, context, signal),
    enabled: !!text.trim(),
    staleTime: Infinity,
    gcTime: 60_000,
  });
  return (
    <div className="px-3.5 py-2.5 text-[13px]" style={{ minHeight }}>
      {!text.trim() ? (
        <p className="text-subtle">Nothing to preview.</p>
      ) : html.error ? (
        <p className="text-danger">{html.error.message}</p>
      ) : html.data === undefined ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : (
        <Markdown html={html.data} />
      )}
    </div>
  );
}
