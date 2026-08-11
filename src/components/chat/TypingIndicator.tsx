"use client";

import { motion } from "framer-motion";
import LunaAvatar from "./LunaAvatar";

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex w-full justify-start"
    >
      <div className="mr-3 self-end">
        <LunaAvatar size="sm" pulse />
      </div>
      <div className="rounded-2xl rounded-bl-md border border-zinc-200/80 bg-white px-4 py-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="typing-dot h-2 w-2 rounded-full bg-emerald-400" />
          <span className="typing-dot h-2 w-2 rounded-full bg-emerald-400" />
          <span className="typing-dot h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="sr-only">Luna is typing</span>
      </div>
    </motion.div>
  );
}
