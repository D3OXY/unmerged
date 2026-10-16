import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

/**
 * Keyboard and ARIA wiring for a search field over the list it filters (palette, file finder). Focus stays
 * in the field: ↑/↓ move the active option (announced through `aria-activedescendant`), ↵ picks it, and the
 * active option scrolls into view. The active option resets to the first whenever `query` changes.
 *
 * Spread `input` on the field, `list` on the listbox and `option(i)` on each option.
 */
export function useCombobox({ count, query, label, pick }: { count: number; query: string; label: string; pick: (index: number) => void }) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  // Results can shrink under the selection (a search landing); keep it on a real option.
  const active = Math.max(0, Math.min(selected, count - 1));
  const optionId = (index: number) => `${id}-${index}`;

  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return {
    active,
    input: {
      role: 'combobox',
      'aria-expanded': count > 0,
      'aria-controls': id,
      'aria-autocomplete': 'list',
      'aria-activedescendant': count > 0 ? optionId(active) : undefined,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') (e.preventDefault(), setSelected(Math.min(count - 1, active + 1)));
        else if (e.key === 'ArrowUp') (e.preventDefault(), setSelected(Math.max(0, active - 1)));
        else if (e.key === 'Enter' && count > 0) (e.preventDefault(), pick(active));
      },
    },
    list: {
      ref: listRef,
      id,
      role: 'listbox',
      'aria-label': label,
      // Clicking an option mustn't take focus out of the field.
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
    },
    option: (index: number) => ({
      id: optionId(index),
      role: 'option',
      'aria-selected': index === active,
      onPointerMove: () => setSelected(index),
      onClick: () => pick(index),
    }),
  } as const;
}
