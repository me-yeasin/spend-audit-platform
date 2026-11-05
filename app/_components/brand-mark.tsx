/**
 * The Spend Audit mark.
 *
 * A clockwise loop with an arrowhead — a charge that comes back every month —
 * wrapped around an audit check. Drawn on a 64-unit grid so the same geometry
 * is reused for the header, the favicon and the home-screen icon.
 */
type BrandMarkProps = { className?: string };

export default function BrandMark({ className = "" }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="19.5" fill="#0E7C5A" />
      <path
        d="M50.1 28.15A18.5 18.5 0 1 1 42.08 16.48"
        stroke="#FBFBF8"
        strokeWidth="5.4"
        strokeLinecap="round"
      />
      <polygon points="38.92 21.35 45.23 11.62 47.78 20.19" fill="#FBFBF8" />
      <path
        d="M24.2 32.4 30.3 38.9 40.9 26.1"
        stroke="#FBFBF8"
        strokeWidth="5.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
