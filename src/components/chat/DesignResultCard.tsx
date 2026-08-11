"use client";

import { motion } from "framer-motion";

interface DesignResultCardProps {
  /** Generated design preview URL from the completed status result. */
  imageUrl: string;
  onAllINeed: () => void;
  onRegenerate: () => void;
  onEngageDesigner: () => void;
}

/**
 * Shown after the design task completes: the generated render with three
 * follow-up actions (all done / regenerate with comments / engage designer).
 */
const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-xl bg-[#37474f] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#263238] dark:bg-[#546e7a] dark:hover:bg-[#455a64]";

export default function DesignResultCard({
  imageUrl,
  onAllINeed,
  onRegenerate,
  onEngageDesigner,
}: DesignResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          Before I get this project over to your design coordinator, I have taken the
          liberty of generating an initial render of how I interpreted your requests.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Generated design preview of your front yard"
            loading="lazy"
            decoding="async"
            className="block h-auto w-full object-cover"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <motion.button
            type="button"
            onClick={onAllINeed}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            className={BUTTON_CLASS}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            This is All I Need
          </motion.button>

          <motion.button
            type="button"
            onClick={onRegenerate}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            className={BUTTON_CLASS}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Regenerate With Comments
          </motion.button>

          <motion.button
            type="button"
            onClick={onEngageDesigner}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            className={BUTTON_CLASS}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Engage Designer
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
