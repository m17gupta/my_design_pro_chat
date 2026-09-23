import { memo } from "react";

interface CadIconProps {
  className?: string;
  size?: number | string;
}

/**
 * Architectural CAD / Blueprint vector icon featuring blueprint drafting grid,
 * technical set-square ruler markings, and a bold white "CAD" badge.
 * Scales crisply at any size.
 */
export const CadIcon = memo(function CadIcon({
  className = "w-6 h-6",
  size,
}: CadIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id="cad-badge-shadow" x="3" y="16.5" width="26" height="15" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#1e1b4b" floodOpacity="0.4" />
        </filter>
        <linearGradient id="cad-sheet-gradient" x1="4" y1="2.5" x2="28" y2="29.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3730A3" />
          <stop offset="1" stopColor="#1E1B4B" />
        </linearGradient>
        <linearGradient id="cad-badge-gradient" x1="5" y1="17.5" x2="27" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>

      {/* Blueprint Sheet */}
      <rect x="4" y="2.5" width="24" height="27" rx="3" fill="url(#cad-sheet-gradient)" stroke="#6366F1" strokeWidth="0.8" strokeOpacity="0.4" />

      {/* Blueprint Grid Lines */}
      <path
        d="M4 8.5H28 M4 14.5H28 M10 2.5V17.5 M16 2.5V17.5 M22 2.5V17.5"
        stroke="#818CF8"
        strokeOpacity="0.22"
        strokeWidth="0.75"
        strokeDasharray="1.5 1.5"
      />

      {/* Architectural Drafting Set-Square Ruler */}
      <polygon
        points="7,17 24,17 7,4.5"
        fill="#4F46E5"
        fillOpacity="0.35"
        stroke="#A5B4FC"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polygon
        points="9,15 18,15 9,8.5"
        fill="#1E1B4B"
        fillOpacity="0.7"
        stroke="#818CF8"
        strokeWidth="0.75"
      />

      {/* Ruler Tick Marks */}
      <path
        d="M10 17V15.5 M12 17V16 M14 17V15.5 M16 17V16 M18 17V15.5 M20 17V16 M22 17V15.5 M7 7H8.5 M7 9H8 M7 11H8.5 M7 13H8 M7 15H8.5"
        stroke="#E0E7FF"
        strokeWidth="0.75"
        strokeLinecap="round"
      />

      {/* Front CAD Badge with Shadow */}
      <rect
        x="5"
        y="17.5"
        width="22"
        height="10.5"
        rx="2.5"
        fill="url(#cad-badge-gradient)"
        filter="url(#cad-badge-shadow)"
      />

      {/* Vector Letters "C A D" */}
      {/* Letter C */}
      <path
        d="M11.8 21.1C11.3 20.6 10.6 20.3 9.9 20.3C8.4 20.3 7.3 21.4 7.3 22.8C7.3 24.1 8.4 25.2 9.9 25.2C10.6 25.2 11.3 24.9 11.8 24.4L12.4 25.1C11.7 25.8 10.8 26.2 9.8 26.2C7.7 26.2 6.2 24.7 6.2 22.8C6.2 20.8 7.7 19.3 9.8 19.3C10.8 19.3 11.7 19.7 12.4 20.4L11.8 21.1Z"
        fill="#FFFFFF"
      />
      {/* Letter A */}
      <path
        d="M15.8 19.6L18.1 25.8H16.8L16.2 24.2H14.4L13.8 25.8H12.5L14.8 19.6H15.8ZM14.7 23.2H15.9L15.3 21.3L14.7 23.2Z"
        fill="#FFFFFF"
      />
      {/* Letter D */}
      <path
        d="M19.6 19.6H22.3C24.1 19.6 25.3 20.8 25.3 22.7C25.3 24.6 24.1 25.8 22.3 25.8H19.6V19.6ZM20.8 20.7V24.7H22.2C23.3 24.7 24.1 23.9 24.1 22.7C24.1 21.5 23.3 20.7 22.2 20.7H20.8Z"
        fill="#FFFFFF"
      />
    </svg>
  );
});
