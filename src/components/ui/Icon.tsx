// Icônes « line » (trait de 1,75 px, géométriques, sans anatomie). Décoratives par défaut (aria-hidden) ; passer `label` pour une icône porteuse de sens.
const PATHS = {
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  ruler: <path d="M3 17 17 3l4 4L7 21l-4-4Zm4-4 2 2m1-5 2 2m1-5 2 2" />,
  barChart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  shieldCheck: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm-3 9 2.2 2.2L15.5 10" />,
  lock: <path d="M6 11h12v9H6v-9Zm3 0V8a3 3 0 0 1 6 0v3" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  scanLine: <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M3 12h18" />,
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />,
  share: <path d="M16 6a2.5 2.5 0 1 0 0-.01M6 12a2.5 2.5 0 1 0 0-.01M16 18a2.5 2.5 0 1 0 0-.01M8.2 10.8l5.6-3.2M8.2 13.2l5.6 3.2" />,
  copy: <path d="M8 8h11v12H8V8Zm-3 8V4h11" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9v.01" />,
  checkCircle: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3.5-9 2.5 2.5L15.5 9.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  camera: <path d="M4 8h3l2-3h6l2 3h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />,
  trash: <path d="M5 7h14M10 7V4h4v3m-8 0 1 13h10l1-13M10 11v6m4-6v6" />,
  users: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6m2 15a6 6 0 0 0-3-5" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {PATHS[name]}
    </svg>
  );
}
