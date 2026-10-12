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
