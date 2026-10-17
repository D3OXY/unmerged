import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { customThemesItem, themeIdItem } from '@/lib/settings';
import { DEFAULT_THEME_ID, findTheme, paletteOf, PRESETS, type Colors, type Mode, type Seeds, type Theme } from '@/lib/theme';

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

/**
 * The presets and the user's own themes as cards, each showing its light and dark palette, then "New theme",
 * which copies the current theme into an editable one. A custom theme in use gets its editor below the cards.
 */
export function ThemePicker({ themeId, custom }: { themeId: string; custom: Theme[] }) {
  const active = findTheme(themeId, custom);

  const create = async () => {
    const theme: Theme = { id: `custom-${crypto.randomUUID()}`, name: `${active.name} copy`, seeds: active.seeds };
    await customThemesItem.setValue([...custom, theme]);
    await themeIdItem.setValue(theme.id);
  };

  return (
    <>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 @md:grid-cols-4">
        {[...PRESETS, ...custom].map((theme) => (
          <ThemeCard key={theme.id} theme={theme} active={theme.id === active.id} />
        ))}
        <button
          type="button"
          onClick={create}
          title={`A copy of ${active.name} to edit`}
          className="flex min-h-[78px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong text-[12px] font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
          New theme
        </button>
      </div>
      {custom.includes(active) && <ThemeEditor key={active.id} theme={active} custom={custom} />}
    </>
  );
}

function ThemeCard({ theme, active }: { theme: Theme; active: boolean }) {
  const palette = paletteOf(theme);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => themeIdItem.setValue(theme.id)}
      className={cx(
        'flex cursor-pointer flex-col overflow-hidden rounded-lg border text-left transition-colors',
        active ? 'border-accent/60 ring-1 ring-accent/60' : 'border-line hover:border-line-strong',
      )}
    >
      <span className="flex h-12">
        <Swatch colors={palette.light} />
        <Swatch colors={palette.dark} />
      </span>
      <span className={cx('truncate border-t border-line px-2 py-1.5 text-[12px] font-medium', active ? 'text-fg' : 'text-muted')}>
        {theme.name || 'Untitled'}
      </span>
    </button>
  );
}

/** A palette in miniature: two lines of text and a button on its background. */
function Swatch({ colors }: { colors: Colors }) {
  return (
    <span className="flex flex-1 flex-col justify-between p-1.5" style={{ background: colors.bg }}>
      <span className="flex flex-col gap-1">
        <span className="h-1 w-3/4 rounded-full" style={{ background: colors.fg }} />
        <span className="h-1 w-1/2 rounded-full" style={{ background: colors.muted }} />
      </span>
      <span className="h-2 w-5 rounded-sm" style={{ background: colors.accent }} />
    </span>
  );
}

/**
 * Name and seed colors of a custom theme. Every change is saved as it's made, so open tabs (this one too)
 * repaint while a color is being picked; the fields keep their own copy so typing never waits on storage.
 */
function ThemeEditor({ theme, custom }: { theme: Theme; custom: Theme[] }) {
  const [draft, setDraft] = useState(theme);

  const save = (next: Theme) => {
    setDraft(next);
    customThemesItem.setValue(custom.map((t) => (t.id === next.id ? next : t)));
  };
  const setSeed = (mode: Mode, key: keyof Seeds, value: string) => save({ ...draft, seeds: { ...draft.seeds, [mode]: { ...draft.seeds[mode], [key]: value } } });
  const remove = async () => {
    await themeIdItem.setValue(DEFAULT_THEME_ID);
    await customThemesItem.setValue(custom.filter((t) => t.id !== theme.id));
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line p-3">
      <div className="flex items-center gap-2">
        <input
          aria-label="Theme name"
          value={draft.name}
          maxLength={32}
          onChange={(e) => save({ ...draft, name: e.target.value })}
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-[12.5px] outline-none transition-colors focus:border-accent/60"
        />
        <button
          type="button"
          onClick={remove}
          title="Delete theme"
          aria-label="Delete theme"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-danger"
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map(({ mode, label }) => (
          <div key={mode} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-medium text-subtle">{label}</span>
            <ColorField label="Background" value={draft.seeds[mode].bg} onChange={(value) => setSeed(mode, 'bg', value)} />
            <ColorField label="Accent" value={draft.seeds[mode].accent} onChange={(value) => setSeed(mode, 'accent', value)} />
          </div>
        ))}
      </div>
      <p className="text-[11.5px] leading-snug text-subtle">Text, borders and surfaces follow from these two, kept readable on the background.</p>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-line px-1.5 transition-colors hover:border-line-strong">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-5 shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-line [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-line [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <span className="min-w-0 flex-1 truncate text-[12px]">{label}</span>
      <span className="hidden font-mono text-[10.5px] text-subtle uppercase @md:inline">{value}</span>
    </label>
  );
}
