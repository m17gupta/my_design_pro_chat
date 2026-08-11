"use client";

import { motion, useReducedMotion } from "framer-motion";

interface LunaAvatarProps {
  size?: "sm" | "md";
  /** Show a soft pulsing ring while Luna is "typing". */
  pulse?: boolean;
}

export default function LunaAvatar({ size = "md", pulse = false }: LunaAvatarProps) {
  const reduceMotion = useReducedMotion();
  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? 15 : 19;

  return (
    <div
      className={`relative ${dims} shrink-0`}
      aria-hidden="true"
    >
      {pulse && !reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full ring-2 ring-emerald-400/70"
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.22, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div
        className={`relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-md shadow-emerald-500/25`}
      >
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          {/* Crescent moon */}
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </div>
    </div>
  );
}
