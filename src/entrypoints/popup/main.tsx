import './style.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { surfacesItem, tokenItem, type Surface, type Surfaces } from '@/lib/settings';
import { Logo } from '@/app/Logo';

const LABELS: Record<Surface, [string, string]> = {
  home: ['Home', 'github.com'],
  profile: ['Profiles', 'github.com/<user>'],
  pr: ['Pull requests', '…/pull/<number>'],
  repo: ['Repositories', 'github.com/<owner>/<repo>'],
};

/** Toolbar popup: token and per-page switches. */
function Popup() {
  const [surfaces, setSurfaces] = useState<Surfaces | null>(null);
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);

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
          <div className="text-[11.5px] text-[#8a8f98]">GitHub, as if it never got acquired.</div>
        </div>
      </div>

      <div className="mt-4 text-[11px] font-medium text-[#62666d]">Pages</div>
      <div className="mt-1.5 flex flex-col overflow-hidden rounded-xl border border-white/8">
        {surfaces &&
          (Object.keys(LABELS) as Surface[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className="flex h-11 cursor-pointer items-center gap-3 border-b border-white/6 px-3 text-left last:border-b-0 hover:bg-white/4"
            >
              <span className="flex-1">
                <span className="block text-[13px] font-medium">{LABELS[key][0]}</span>
                <span className="block font-mono text-[11px] text-[#62666d]">{LABELS[key][1]}</span>
              </span>
              <span className={`relative h-[18px] w-8 rounded-full transition-colors ${surfaces[key] !== false ? 'bg-[#7170ff]' : 'bg-white/12'}`}>
                <span className={`absolute top-[2px] size-[14px] rounded-full bg-white transition-all ${surfaces[key] !== false ? 'left-[16px]' : 'left-[2px]'}`} />
              </span>
            </button>
          ))}
      </div>

      <div className="mt-4 text-[11px] font-medium text-[#62666d]">GitHub token</div>
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
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/8 bg-black/30 px-2.5 font-mono text-[12px] outline-none focus:border-[#7170ff]/60"
        />
        <button type="submit" className="h-8 cursor-pointer rounded-lg bg-[#7170ff] px-3 text-[12.5px] font-medium hover:brightness-110">
          {saved ? 'Saved' : 'Save'}
        </button>
      </form>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
