import type { ReactNode, Ref } from 'react';
import { cx } from '@/lib/cx';

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
  className?: string;
  /** The action bar under the text. */
  children: ReactNode;
};

/** The box every comment is written in (conversation, thread replies, line comments): multi-line Markdown with an action bar. */
export function CommentBox({ value, onChange, onSubmit, onClose, placeholder, rows = 3, autoFocus, textareaRef, className, children }: Props) {
  return (
    <div className={cx('rounded-xl border border-line bg-panel focus-within:border-line-strong', className)}>
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
      <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">{children}</div>
    </div>
  );
}
