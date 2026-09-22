import { memo } from "react";

interface ExcelIconProps {
  className?: string;
  size?: number | string;
}

/**
 * Microsoft Excel spreadsheet icon featuring the classic green
 * workbook grid and bold white "X" badge. Scales crisply at any size.
 */
export const ExcelIcon = memo(function ExcelIcon({
  className = "w-6 h-6",
  size,
}: ExcelIconProps) {
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
        <filter id="excel-tile-shadow" x="1.5" y="4.5" width="21" height="23" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.22" />
        </filter>
        <linearGradient id="excel-back-gradient" x1="16" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22A565" />
          <stop offset="1" stopColor="#107C41" />
        </linearGradient>
        <linearGradient id="excel-tile-gradient" x1="4" y1="7" x2="20" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#107C41" />
          <stop offset="1" stopColor="#0B5A2F" />
        </linearGradient>
      </defs>

      {/* Back workbook sheet */}
      <rect x="11" y="4" width="17" height="24" rx="2.5" fill="url(#excel-back-gradient)" />

      {/* Spreadsheet grid cells on the right */}
      <rect x="17" y="7.5" width="8.5" height="3" rx="0.5" fill="#ffffff" fillOpacity="0.4" />
      <rect x="17" y="12" width="8.5" height="3" rx="0.5" fill="#ffffff" fillOpacity="0.4" />
      <rect x="17" y="16.5" width="8.5" height="3" rx="0.5" fill="#ffffff" fillOpacity="0.4" />
      <rect x="17" y="21" width="8.5" height="3" rx="0.5" fill="#ffffff" fillOpacity="0.4" />

      {/* Front tile with shadow */}
      <rect
        x="4"
        y="7"
        width="16"
        height="18"
        rx="2.5"
        fill="url(#excel-tile-gradient)"
        filter="url(#excel-tile-shadow)"
      />

      {/* Signature white 'X' */}
      <path
        d="M7.8 11.5L10.3 16L7.6 20.5H9.7L11.3 17.5L12.9 20.5H15L12.3 16L14.8 11.5H12.7L11.3 14.3L9.9 11.5H7.8Z"
        fill="#ffffff"
      />
    </svg>
  );
});
