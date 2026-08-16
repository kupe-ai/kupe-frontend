/** Plivo wordmark, inline so the add-number dialog can show it without an
 * external asset request (this app is CSP-strict / offline-safe). Matches
 * Plivo's own brand color (#E11660). */
export function PlivoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Plivo">
      <circle cx="10" cy="12" r="9" fill="#E11660" />
      <path d="M7 7.5h3.6a2.9 2.9 0 0 1 0 5.8H8.9V16.5H7V7.5Zm1.9 1.7v2.4h1.6a1.2 1.2 0 0 0 0-2.4H8.9Z" fill="white" />
      <text x="24" y="17" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="13" fontWeight="700" fill="currentColor">
        Plivo
      </text>
    </svg>
  );
}
