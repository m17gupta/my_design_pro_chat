"use client";

import { motion, useReducedMotion } from "framer-motion";

const LUNA_LOGO = "https://mydesigns.pro/img/luna-logo.jpg";

interface LunaAvatarProps {
  size?: "sm" | "md";
  /** Show a soft pulsing ring while Luna is "typing". */
  pulse?: boolean;
}

export default function LunaAvatar({ size = "md", pulse = false }: LunaAvatarProps) {
  const reduceMotion = useReducedMotion();
  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10";

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
        className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white shadow-md shadow-emerald-500/25`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LUNA_LOGO}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
