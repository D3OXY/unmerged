import type { Achievement } from '@/github/achievements';
import { cx } from '@/lib/cx';

const METALS: Record<string, string> = { bronze: '#c38b5f', silver: '#a5b1bd', gold: '#e3b341' };

/** An achievement's "x2"/"x3"/"x4" pill, tinted bronze, silver or gold like GitHub's. */
export function TierLabel({ tier, className }: { tier: NonNullable<Achievement['tier']>; className?: string }) {
  const metal = tier.metal ? METALS[tier.metal] : undefined;
  return (
    <span
      className={cx('rounded-full border border-line-strong bg-elevated font-semibold', className)}
      style={metal ? { color: metal, borderColor: `color-mix(in srgb, ${metal} 45%, transparent)` } : undefined}
    >
      {tier.label}
    </span>
  );
}
