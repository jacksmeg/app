export const JhimsLogo = ({
  size = "header",
}: {
  size?: "header" | "auth";
}) => (
  <div className={`jhims-logo ${size === "auth" ? "jhims-logo-auth" : "jhims-logo-header"}`}>
    <div className="jhims-logo-mark" aria-hidden="true">
      <svg viewBox="0 0 72 72" role="img">
        <defs>
          <linearGradient id="jhimsLogoPanel" x1="6" y1="10" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0ea561" />
            <stop offset="1" stopColor="#19b8ae" />
          </linearGradient>
          <linearGradient id="jhimsLogoAwning" x1="13" y1="16" x2="56" y2="31" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f59d23" />
            <stop offset="1" stopColor="#ffbf59" />
          </linearGradient>
        </defs>
        <rect x="6" y="10" width="50" height="50" rx="16" fill="#eaf8f2" stroke="url(#jhimsLogoPanel)" strokeWidth="2.6" />
        <path d="M17 20.5C17 18 18.9 16 21.3 16H42.7C45.1 16 47 18 47 20.5V23H17V20.5Z" fill="#0b7f4a" />
        <path d="M14 23H50L47.5 31.5C47.1 33 45.8 34 44.2 34H19.8C18.2 34 16.9 33 16.5 31.5L14 23Z" fill="url(#jhimsLogoAwning)" />
        <path d="M19 31H45" stroke="#ffffff" strokeLinecap="round" strokeWidth="1.6" opacity="0.7" />
        <rect x="19" y="34.5" width="26" height="17" rx="6" fill="#ffffff" stroke="#0ea561" strokeWidth="2" />
        <rect x="23.5" y="39" width="6.5" height="12.5" rx="2.6" fill="#0ea561" />
        <rect x="33.5" y="39" width="7" height="7" rx="2.2" fill="#eaf3ff" />
        <path d="M52 44.5C56.1 39.4 61.8 38.5 66 42.2C63.9 42.2 62.2 42.8 60.8 44.1C59.4 45.4 58.6 47.1 58.4 49.3C55 49.3 52.5 47.4 52 44.5Z" fill="#243246" opacity="0.12" />
        <path d="M53 42.5C56.3 38.2 62.1 37.6 66 41.1C63.9 41.2 62.1 41.9 60.8 43.4C59.6 44.8 58.9 46.5 58.8 48.5C55.5 48.3 53.4 46.6 53 42.5Z" fill="#f59d23" />
        <circle cx="37.2" cy="24.6" r="1.8" fill="#ffffff" opacity="0.82" />
        <circle cx="28" cy="24.6" r="1.8" fill="#ffffff" opacity="0.82" />
      </svg>
    </div>
    <div className="jhims-logo-copy">
      <span className="jhims-logo-title">JHIMS</span>
      <span className="jhims-logo-subtitle">Marketplace</span>
    </div>
  </div>
);
