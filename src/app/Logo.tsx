import holdout from '@/assets/logo/holdout.svg?raw';
import holdoutSmall from '@/assets/logo/holdout-16.svg?raw';

/** Holdout, the Unmerged mascot. At 28px and below it uses the version drawn on a 16px grid. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 [&>svg]:size-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: size <= 28 ? holdoutSmall : holdout }}
    />
  );
}
