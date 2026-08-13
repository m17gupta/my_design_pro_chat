"use client";

import { motion } from "framer-motion";

interface OptionButtonsProps {
  options: string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}

const PhotoIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2.5"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export default function OptionButtons({
  options,
  disabled = false,
  onSelect,
}: OptionButtonsProps) {
  
  const getOptionConfig = (option: string) => {
    const norm = option.toLowerCase().replace(/[^a-z]/g, "");
    const isYes = norm === "yesido";
    const isNo = norm === "noidont";

    if (isYes) {
      return {
        label: "Yes, I do",
        className:
          "inline-flex items-center gap-2 rounded-lg bg-emerald-500 border border-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-emerald-600 hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50",
        icon: <PhotoIcon />,
      };
    }

    if (isNo) {
      return {
        label: "No, I don't",
        className:
          "inline-flex items-center gap-2 rounded-lg bg-white border border-[#CBD5E1] px-5 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition-all duration-150 hover:bg-zinc-50 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/50",
        icon: <CloseIcon />,
      };
    }

    // Default option styles (e.g. Next, Ready to Proceed)
    return {
      label: option,
      className:
        "inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#CBD5E1] px-5 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition-all duration-150 hover:bg-zinc-50 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/50",
      icon: null,
    };
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2.5" role="group" aria-label="Choose an answer">
      {options.map((option, i) => {
        const { label, className, icon } = getOptionConfig(option);
        return (
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
            whileHover={disabled ? undefined : { scale: 1.02, y: -0.5 }}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            className={className}
          >
            {icon}
            <span>{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
