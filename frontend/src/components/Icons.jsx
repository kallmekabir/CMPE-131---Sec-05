// Simple inline SVG icons (no icon library needed). Each takes an optional size.
const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export const HomeIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const CalendarIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </svg>
);
export const PlusCircleIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7.5v9M7.5 12h9" />
  </svg>
);
export const PinIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const UserIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </svg>
);
export const XIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const CheckIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);
export const InfoIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 11v6M12 7.5v.01" />
  </svg>
);
export const BackIcon = ({ size = 24 }) => (
  <svg {...base(size)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ShareIcon = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);
export const NavigateIcon = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M3 11 21 3l-8 18-2-8z" />
  </svg>
);
export const ClockIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const UsersIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3c2.1.7 3.5 2.6 3.5 5.7" />
  </svg>
);
