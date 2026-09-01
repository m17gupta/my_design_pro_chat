"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import ProgressChecklist from "./ProgressChecklist";
import type { ChecklistItem } from "./types";
import type { Episode } from "./flow";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectTypingSpeed,
  setTypingSpeed,
  type TypingSpeed,
} from "@/store/settings/settingsSlice";

interface SettingsMenuProps {
  onStartOver: () => void;
  checklist?: ChecklistItem[] | null;
  completed: ReadonlySet<string>;
  currentId: string | null;
  episodes: Episode[];
}

const SPEED_OPTIONS: Array<{
  id: TypingSpeed;
  title: string;
  desc: string;
  recommended?: boolean;
}> = [
  {
    id: "slow",
    title: "Slow",
    desc: "Relaxed and easy to follow",
  },
  {
    id: "normal",
    title: "Normal",
    desc: "A natural conversation pace",
    recommended: true,
  },
  {
    id: "fast",
    title: "Fast",
    desc: "Quicker responses with less waiting",
  },
];

export default function SettingsMenu({
  onStartOver,
  checklist,
  completed,
  currentId,
  episodes,
}: SettingsMenuProps) {
  const dispatch = useAppDispatch();
  const currentSpeed = useAppSelector(selectTypingSpeed);

  const [isOpen, setIsOpen] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showResetConfirm) setShowResetConfirm(false);
        else if (showChecklistModal) setShowChecklistModal(false);
        else if (isOpen) setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showChecklistModal, showResetConfirm]);

  const doneCount = checklist ? checklist.filter((item) => completed.has(item.id)).length : 0;
  const totalCount = checklist ? checklist.length : 0;

  return (
    <>
      {/* Floating Settings Button — Always pinned top-right */}
      <div className="fixed top-4 right-4 sm:top-5 sm:right-6 z-40">
        <div className="relative">
          <motion.button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label="Settings"
            title="Settings"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`group flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
              isOpen
                ? "border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-200/90 bg-white/80 text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-white"
            }`}
          >
            <i
              className={`bi bi-gear-fill text-[16px] sm:text-[17px] transition-transform duration-300 ${
                isOpen ? "rotate-90 text-emerald-600 dark:text-emerald-400" : "group-hover:rotate-45"
              }`}
            />
          </motion.button>

          {/* Settings Dropdown Popover */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-11 sm:top-12 z-50 w-72 sm:w-80 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95"
              >
                {/* Typing Speed Section */}
                <div className="px-2.5 pt-1.5 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold  tracking-wider text-zinc-400 dark:text-zinc-500">
                    Choose luna’s typing speed
                    </p>
                    <span className="text-[11px] font-medium capitalize text-emerald-600 dark:text-emerald-400">
                      {currentSpeed}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {SPEED_OPTIONS.map((opt) => {
                      const isSelected = currentSpeed === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => dispatch(setTypingSpeed(opt.id))}
                          className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                            isSelected
                              ? "bg-emerald-50/80 border border-emerald-300/80 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-700/60 dark:text-emerald-100"
                              : "border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-100/80 text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 dark:text-zinc-300"
                          }`}
                        >
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400'
                              : 'border-zinc-300 dark:border-zinc-600'
                          }">
                            {isSelected && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-zinc-900" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold leading-none">
                                {opt.title}
                              </span>
                              {opt.recommended && (
                                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700 dark:text-emerald-300 leading-none">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                              {opt.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

          

                
            
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Checklist Modal */}
      {mounted &&
        showChecklistModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Intake Progress Checklist"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowChecklistModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative max-h-[85vh] w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Intake Progress
                </h3>
                <button
                  type="button"
                  onClick={() => setShowChecklistModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Close checklist"
                >
                  <i className="bi bi-x-lg text-sm" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <ProgressChecklist
                  completed={completed}
                  currentId={currentId}
                  episodes={episodes}
                  checklist={checklist}
                  animate={false}
                />
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* Reset Confirmation Modal */}
      {mounted &&
        showResetConfirm &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm restart"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-sm rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/50 dark:text-red-400 mb-4">
                <i className="bi bi-arrow-counterclockwise text-2xl" />
              </div>

              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Start Over?
              </h3>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                This will clear your previous answers and restart the design intake from the beginning.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    onStartOver();
                  }}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 shadow-sm transition-colors"
                >
                  Reset & Start Over
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  );
}
