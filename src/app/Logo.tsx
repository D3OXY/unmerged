/** A branch that forks off and never comes back: the Unmerged mark. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="7" fill="url(#u-logo)" />
      <path d="M8.5 6.5v11M8.5 13c0-3 2-4.5 6.5-5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="8.5" cy="6.5" r="1.9" fill="#fff" />
      <circle cx="8.5" cy="17.5" r="1.9" fill="#fff" />
      <circle cx="16" cy="8" r="1.9" fill="#fff" />
      <defs>
        <linearGradient id="u-logo" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#8b8bff" />
          <stop offset="1" stopColor="#5e3fd6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
