"use client";

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { ProjectAddress } from "../../lib/apiBrief";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { selectProjectAddress, setContext, setProjectAddress } from "../../store/briefSlice";

interface EditAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (address: ProjectAddress) => void;
  initialAddress?: ProjectAddress | null;
}

function EditAddressModal({
  isOpen,
  onClose,
  onSave,
  initialAddress,
}: EditAddressModalProps) {
  const dispatch = useAppDispatch();
  const reduxAddress = useAppSelector(selectProjectAddress);
  const activeInitial = initialAddress ?? reduxAddress;

  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState(activeInitial?.address ?? "");
  const [city, setCity] = useState(activeInitial?.city ?? "");
  const [state, setState] = useState(activeInitial?.state ?? "");
  const [zipCode, setZipCode] = useState(activeInitial?.zip_code ?? "");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state whenever modal opens or activeInitial changes
  useEffect(() => {
    if (isOpen) {
      setAddress(activeInitial?.address ?? "");
      setCity(activeInitial?.city ?? "");
      setState(activeInitial?.state ?? "");
      setZipCode(activeInitial?.zip_code ?? "");
    }
  }, [isOpen, activeInitial]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAddress: ProjectAddress = {
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zip_code: zipCode.trim(),
    };

    // Update Redux state
    dispatch(setProjectAddress(updatedAddress));
    dispatch(setContext({ project_address: updatedAddress }));

    onSave?.(updatedAddress);
    onClose();
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit Property Address"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-5 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Edit Property Address
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Update the project address details below
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Street Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Main Street"
                className="w-full rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm text-zinc-800 shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Jaipur"
                  className="w-full rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm text-zinc-800 shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Rajasthan"
                  className="w-full rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm text-zinc-800 shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Zip Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 20802"
                className="w-full rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm text-zinc-800 shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 transition-all hover:brightness-110 active:scale-95"
              >
                Save Address
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

export default memo(EditAddressModal);
