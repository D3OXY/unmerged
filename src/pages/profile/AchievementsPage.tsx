import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { achievementDetailQuery, achievementsQuery, type Achievement } from '@/github/achievements';
import { formatDate } from '@/lib/time';
import { Modal } from '@/ui/Modal';
import { Empty, Skeleton } from '@/ui/primitives';
import { ProfileFrame } from './ProfileFrame';
import { TierLabel } from './TierLabel';

/** Earned achievements as a grid; one opens into its story (what it's for, when, and what earned it). */
export function AchievementsPage({ login }: { login: string }) {
  const { data, isPending, error } = useQuery(achievementsQuery(login));
  // `?achievement=<slug>` is GitHub's own URL for an open achievement, so links and reloads land on it.
  const [open, setOpen] = useState(() => new URL(location.href).searchParams.get('achievement'));

  useEffect(() => {
    const url = new URL(location.href);
    if (open) url.searchParams.set('achievement', open);
    else url.searchParams.delete('achievement');
    history.replaceState(history.state, '', url);
  }, [open]);

  const achievement = data?.find((a) => a.slug === open);

  return (
    <ProfileFrame login={login} tab="achievements">
      {error ? (
        <p className="py-10 text-danger">{error.message}</p>
      ) : (
        <div className="mt-6 grid animate-enter grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {isPending && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[196px] rounded-xl" />)}
          {data?.map((a) => <AchievementCard key={a.slug} achievement={a} onOpen={() => setOpen(a.slug)} />)}
        </div>
      )}
      {data?.length === 0 && <Empty>No achievements yet.</Empty>}
      {achievement && <AchievementDialog login={login} achievement={achievement} onClose={() => setOpen(null)} />}
    </ProfileFrame>
  );
}

function AchievementCard({ achievement: { name, image, tier }, onOpen }: { achievement: Achievement; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-row
      onClick={onOpen}
      className="group flex cursor-pointer flex-col items-center rounded-xl border border-line bg-panel px-4 pt-6 pb-5 transition-colors hover:border-line-strong hover:bg-hover focus:outline-none focus-visible:border-accent/60"
    >
      <img src={image} alt="" className="size-24 transition-transform duration-200 ease-out group-hover:scale-105 motion-reduce:transition-none" />
      <span className="mt-4 flex items-center gap-1.5 text-[13.5px] font-semibold">
        {name}
        {tier && <TierLabel tier={tier} className="px-1.5 text-[10.5px] leading-4" />}
      </span>
    </button>
  );
}

function AchievementDialog({ login, achievement: { slug, name, image, tier }, onClose }: { login: string; achievement: Achievement; onClose: () => void }) {
  const { data: detail, isPending, error } = useQuery(achievementDetailQuery(login, slug));

  return (
    <Modal label={name} onClose={onClose} className="w-[460px]">
      <div
        className="relative flex h-[180px] items-center justify-center bg-panel bg-cover bg-center"
        style={detail?.backdrop ? { backgroundImage: `url(${detail.backdrop})` } : undefined}
      >
        <img src={image} alt="" className="size-32 drop-shadow-xl" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 flex size-7 cursor-pointer items-center justify-center rounded-md bg-black/30 text-white/80 backdrop-blur hover:bg-black/50 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-semibold tracking-tight">{name}</h2>
          {tier && <TierLabel tier={tier} className="px-1.5 text-[11px] leading-[18px]" />}
        </div>

        {error ? (
          <p className="mt-2 text-[13px] text-danger">{error.message}</p>
        ) : isPending ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{detail.description}</p>

            {detail.tiers.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                {detail.tiers.map((src, i) => (
                  <img key={src} src={src} alt="" title={i === 0 ? 'Base' : `Tier ${i + 1}`} className="size-9" />
                ))}
              </div>
            )}

            {(detail.unlocked || detail.history.length > 0) && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="mb-2 text-[11.5px] font-medium text-subtle">History</h3>
                <ol className="flex flex-col gap-2 border-l border-line pl-3.5 text-[12.5px] leading-snug text-muted">
                  {detail.unlocked && (
                    <li className="relative">
                      <span className="absolute top-1.5 -left-[18px] size-[7px] rounded-full bg-success ring-2 ring-elevated" />
                      <span className="font-medium text-fg">{detail.unlocked.label}</span> {formatDate(detail.unlocked.at)}
                    </li>
                  )}
                  {detail.history.map((line, i) => (
                    <li key={i} className="relative">
                      <span className="absolute top-1.5 -left-[17.5px] size-[6px] rounded-full bg-line-strong ring-2 ring-elevated" />
                      {line.map((part, j) =>
                        part.href ? (
                          <a key={j} href={part.href} className="text-fg hover:text-accent hover:underline">
                            {part.text}
                          </a>
                        ) : (
                          <span key={j}>{part.text}</span>
                        ),
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
