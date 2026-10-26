import { useCallback, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { renderMarkdown } from '@/github/client';
import { cx } from '@/lib/cx';
import { completeMention, mentionAt, type Mention } from './mention';
import { MentionList, useMentionable } from './MentionList';
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
  /**
   * "owner/repo" the comment goes to: adds a Preview tab that renders the text as GitHub will, references and
   * all, and suggests people as an @mention is typed.
   */
  repo?: string;
  className?: string;
  /** The action bar under the text. */
  children: ReactNode;
};

/** The box every comment is written in (conversation, thread replies, line comments): multi-line Markdown with an action bar. */
export function CommentBox({ value, onChange, onSubmit, onClose, placeholder, rows = 3, autoFocus, textareaRef, repo, className, children }: Props) {
  const [previewing, setPreviewing] = useState(false);
  const showPreview = previewing && !!repo;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const setTextarea = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textarea.current = el;
      if (typeof textareaRef === 'function') textareaRef(el);
      else if (textareaRef) textareaRef.current = el;
    },
    [textareaRef],
  );
  const [mention, setMention] = useState<Mention | null>(null);
  const [active, setActive] = useState(0);
  const people = useMentionable(repo, mention?.query);
  const listId = useId();
  const suggesting = !!mention && people.length > 0;

  /** Follows the caret: a mention is being typed while it sits right after one. */
  const track = (el: HTMLTextAreaElement) => {
    const next = el.selectionStart === el.selectionEnd ? mentionAt(el.value, el.selectionStart) : null;
    if (next?.start !== mention?.start || next?.query !== mention?.query) setActive(0);
    setMention(next);
  };
  const pick = (login: string) => {
    const el = textarea.current;
    if (!el || !mention) return;
    const done = completeMention(value, el.selectionStart, mention, login);
    onChange(done.text);
    setMention(null);
    // After React has written the new text, which moves the caret to its end.
    requestAnimationFrame(() => el.setSelectionRange(done.caret, done.caret));
  };

  return (
    <div className={cx('rounded-xl border border-line bg-panel focus-within:border-line-strong', className)}>
      {repo && (
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
        <MarkdownPreview text={value} context={repo} minHeight={rows * 22 + 20} />
      ) : (
        <textarea
          ref={setTextarea}
          autoFocus={autoFocus}
          rows={rows}
          value={value}
          aria-autocomplete={repo ? 'list' : undefined}
          aria-expanded={repo ? suggesting : undefined}
          aria-controls={suggesting ? listId : undefined}
          aria-activedescendant={suggesting ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            onChange(e.target.value);
            if (repo) track(e.target);
          }}
          onSelect={(e) => repo && track(e.currentTarget)}
          onBlur={() => setMention(null)}
          onKeyDown={(e) => {
            const submit = e.key === 'Enter' && (e.metaKey || e.ctrlKey);
            if (suggesting && !submit) {
              const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
              if (e.key in moves) setActive((active + moves[e.key]! + people.length) % people.length);
              else if (e.key === 'Enter' || e.key === 'Tab') pick(people[active]!.login);
              else if (e.key === 'Escape') setMention(null);
              else return;
              return e.preventDefault();
            }
            if (submit) {
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
      {suggesting && textarea.current && !showPreview && (
        <MentionList id={listId} textarea={textarea.current} at={mention.start} people={people} active={active} onPick={pick} />
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
