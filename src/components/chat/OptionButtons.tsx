"use client";

import { motion } from "framer-motion";

interface OptionButtonsProps {
  options: string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}

export default function OptionButtons({
  options,
  disabled = false,
  onSelect,
}: OptionButtonsProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose an answer">
      {options.map((option, i) => (
        <motion.button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          disabled={disabled}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.12 + i * 0.06,
            type: "spring",
            stiffness: 380,
            damping: 26,
          }}
          whileHover={disabled ? undefined : { scale: 1.04, y: -1 }}
          whileTap={disabled ? undefined : { scale: 0.95 }}
          className="rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm backdrop-blur transition-colors duration-150 hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/30 dark:bg-zinc-900/80 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
        >
          {option}
        </motion.button>
      ))}
    </div>
  );
}
