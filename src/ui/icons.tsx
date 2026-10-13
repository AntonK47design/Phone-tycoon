// Small stroke icons (replaces emoji so the UI looks the same on every platform).

type P = { size?: number };

const svg = (size: number, children: preact.ComponentChildren) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconPencil = ({ size = 20 }: P) => svg(size, <><path d="M4 20l1-5L16 4l4 4L9 19z" /><path d="M14 6l4 4" /></>);
export const IconRocket = ({ size = 20 }: P) =>
  svg(size, <><path d="M12 3c4 2 6 6 5 11l-3 3h-4l-3-3c-1-5 1-9 5-11z" /><circle cx="12" cy="10" r="1.8" /><path d="M9 17l-3 4M15 17l3 4" /></>);
export const IconWrench = ({ size = 20 }: P) => svg(size, <path d="M15 4a5 5 0 0 0-5 6l-6 6 4 4 6-6a5 5 0 0 0 6-5l-3 1-2-2z" />);
export const IconTrophy = ({ size = 20 }: P) =>
  svg(size, <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></>);
export const IconPaint = ({ size = 20 }: P) =>
  svg(size, <><rect x="4" y="3" width="13" height="7" rx="1.5" /><path d="M17 6h2v5l-7 2v3" /><rect x="10" y="16" width="4" height="5" rx="1" /></>);
export const IconBox = ({ size = 20 }: P) => svg(size, <><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>);
export const IconWarn = ({ size = 20 }: P) => svg(size, <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>);
export const IconSpark = ({ size = 20 }: P) => svg(size, <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />);
export const IconBuilding = ({ size = 20 }: P) =>
  svg(size, <><rect x="4" y="3" width="12" height="18" /><path d="M16 9h4v12h-4M8 7h4M8 11h4M8 15h4" /></>);
export const IconTeam = ({ size = 20 }: P) =>
  svg(size, <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14c3 0 5 2.2 5 5" /></>);
export const IconFactory = ({ size = 20 }: P) =>
  svg(size, <><path d="M3 21V10l5 3V10l5 3V10l5 3V4h3v17z" /><path d="M7 17h2M12 17h2" /></>);
export const IconFlask = ({ size = 20 }: P) => svg(size, <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M7.5 15h9" /></>);
export const IconChart = ({ size = 20 }: P) => svg(size, <><path d="M4 20V4M4 20h16" /><path d="M7 15l4-4 3 3 5-6" /></>);
export const IconGlobe = ({ size = 20 }: P) =>
  svg(size, <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" /></>);
export const IconCrown = ({ size = 20 }: P) => svg(size, <><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" /><path d="M5 19h14" /></>);
export const IconHelp = ({ size = 20 }: P) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5" /></>);
export const IconClose = ({ size = 18 }: P) => svg(size, <path d="M6 6l12 12M18 6L6 18" />);

export type ToastIcon = 'trophy' | 'paint' | 'box' | 'warn' | 'spark' | 'building';
export function ToastIconView({ kind }: { kind: ToastIcon }) {
  switch (kind) {
    case 'trophy':
      return <IconTrophy />;
    case 'paint':
      return <IconPaint />;
    case 'box':
      return <IconBox />;
    case 'warn':
      return <IconWarn />;
    case 'spark':
      return <IconSpark />;
    case 'building':
      return <IconBuilding />;
  }
}
