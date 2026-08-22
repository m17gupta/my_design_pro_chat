"use client";

import { motion } from "framer-motion";
import LunaAvatar from "./LunaAvatar";

/**
 * Premium thinking indicator — glassmorphism bubble with a staggered wave.
 * Matches the new ChatGPT/Claude aesthetic.
 */
export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 6, filter: "blur(4px)", transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full items-end justify-start"
    >
      {/* Avatar */}
      <div className="mr-3 mb-0.5 shrink-0">
        <LunaAvatar size="sm" pulse />
      </div>

      {/* Glassmorphism thinking bubble */}
      <div
        className="
          flex items-center gap-1.5
          rounded-2xl rounded-bl-sm
          border border-zinc-200/70
          bg-white/80
          px-4 py-3
          shadow-sm
          backdrop-blur-sm
          dark:border-zinc-700/60
          dark:bg-zinc-900/80
        "
      >
        {/* Premium wave dots using .thinking-dot from globals.css */}
        <span className="thinking-dot h-[7px] w-[7px] rounded-full bg-zinc-400 dark:bg-zinc-500" />
        <span className="thinking-dot h-[7px] w-[7px] rounded-full bg-zinc-400 dark:bg-zinc-500" />
        <span className="thinking-dot h-[7px] w-[7px] rounded-full bg-zinc-400 dark:bg-zinc-500" />
        <span className="sr-only">Luna is thinking…</span>
      </div>
    </motion.div>
  );
}
