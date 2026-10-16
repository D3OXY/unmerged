import { Modal } from '@/ui/Modal';
import { Kbd } from '@/ui/primitives';
import { pageHotkeys, shortcutsOpen } from './keyboard';

/** Keys `installKeyboard` handles on every page, plus Escape for dialogs and menus. */
const GLOBAL = [
  { keys: ['⌘', 'K'], label: 'Command palette' },
  { keys: ['J', 'K'], label: 'Next / previous row' },
  { keys: ['G', 'H'], label: 'Go home' },
  { keys: ['G', 'P'], label: 'Go to your profile' },
  { keys: ['?'], label: 'Keyboard shortcuts' },
  { keys: ['Esc'], label: 'Close a dialog or menu' },
];

/** The `?` overlay: global shortcuts and whatever keys the current page has bound. */
export function ShortcutsDialog() {
  const open = shortcutsOpen.use();
  if (!open) return null;
  const page = pageHotkeys().map(({ key, label }) => ({ keys: [key.toUpperCase()], label: label ?? 'Page shortcut' }));

  return (
    <Modal label="Keyboard shortcuts" onClose={() => shortcutsOpen.set(false)} className="w-[380px]">
      <h2 className="px-4 pt-4 pb-1 text-[14px] font-semibold tracking-tight">Keyboard shortcuts</h2>
      <Section title="Everywhere" shortcuts={GLOBAL} />
      {page.length > 0 && <Section title="This page" shortcuts={page} />}
    </Modal>
  );
}

function Section({ title, shortcuts }: { title: string; shortcuts: { keys: string[]; label: string }[] }) {
  return (
    <section className="px-4 pt-2 pb-3">
      <h3 className="pb-1 text-[11px] font-medium text-subtle">{title}</h3>
      <dl>
        {shortcuts.map(({ keys, label }) => (
          <div key={keys.join(' ')} className="flex h-8 items-center gap-3 text-[13px]">
            <dt className="flex-1 text-fg/90">{label}</dt>
            <dd className="flex gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
