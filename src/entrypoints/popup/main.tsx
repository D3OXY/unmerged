import './style.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isDark, surfacesItem, themeItem, tokenItem, useStorageItem, type Surface, type Surfaces, type Theme } from '@/lib/settings';
import { Logo } from '@/app/Logo';

const LABELS: Record<Surface, [string, string]> = {
  home: ['Home', 'github.com'],
  profile: ['Profiles', 'github.com/<user>'],
  pr: ['Pull requests', '…/pull/<number>'],
  repo: ['Repositories', 'github.com/<owner>/<repo>'],
};

const THEMES: [Theme, string][] = [
  ['auto', 'Auto'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

/** Toolbar popup: theme, per-page switches, and token. */
function Popup() {
  const [surfaces, setSurfaces] = useState<Surfaces | null>(null);
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const theme = useStorageItem(themeItem);

  useEffect(() => {
    if (theme) document.documentElement.classList.toggle('dark', isDark(theme));
  }, [theme]);

  useEffect(() => {
    surfacesItem.getValue().then(setSurfaces);
    tokenItem.getValue().then(setToken);
  }, []);

  const toggle = (key: Surface) => {
    if (!surfaces) return;
    const next = { ...surfaces, [key]: surfaces[key] === false };
    setSurfaces(next);
    surfacesItem.setValue(next);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2.5">
        <Logo size={26} />
        <div>
          <div className="text-[14px] font-semibold tracking-tight">Unmerged</div>
          <div className="text-[11.5px] text-muted">GitHub, as if it never got acquired.</div>
        </div>
      </div>

      <div className="mt-4 text-[11px] font-medium text-subtle">Theme</div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border border-line p-1">
        {THEMES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => themeItem.setValue(value)}
            className={`h-7 cursor-pointer rounded-lg text-[12.5px] font-medium transition-colors ${theme === value ? 'bg-elevated text-fg' : 'text-muted hover:text-fg'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 text-[11px] font-medium text-subtle">Pages</div>
      <div className="mt-1.5 flex flex-col overflow-hidden rounded-xl border border-line">
        {surfaces &&
          (Object.keys(LABELS) as Surface[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className="flex h-11 cursor-pointer items-center gap-3 border-b border-line px-3 text-left last:border-b-0 hover:bg-hover"
            >
              <span className="flex-1">
                <span className="block text-[13px] font-medium">{LABELS[key][0]}</span>
                <span className="block font-mono text-[11px] text-subtle">{LABELS[key][1]}</span>
              </span>
              <span className={`relative h-[18px] w-8 rounded-full transition-colors ${surfaces[key] !== false ? 'bg-accent' : 'bg-line-strong'}`}>
                <span className={`absolute top-[2px] size-[14px] rounded-full bg-white transition-all ${surfaces[key] !== false ? 'left-[16px]' : 'left-[2px]'}`} />
              </span>
            </button>
          ))}
      </div>

      <div className="mt-4 text-[11px] font-medium text-subtle">GitHub token</div>
      <form
        className="mt-1.5 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await tokenItem.setValue(token.trim());
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_…"
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 font-mono text-[12px] outline-none focus:border-accent/60"
        />
        <button type="submit" className="h-8 cursor-pointer rounded-lg bg-accent px-3 text-accent-fg text-[12.5px] font-medium hover:brightness-110">
          {saved ? 'Saved' : 'Save'}
        </button>
      </form>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
