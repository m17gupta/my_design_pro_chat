"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ChecklistItem } from "./types";

interface TypewriterState {
  completedIndex: number;
  currentText: string;
}

export interface LineTypewriterOptions {
  /** Whether the typing animation is enabled (default: true). */
  enabled?: boolean;
  /** Typing speed per word/token in milliseconds (default: 40ms). Lower = faster word typing. */
  speedMs?: number;
  /** Time gap / pause in milliseconds between finishing one line and starting the next (default: 150ms). Higher = longer gap between lines. */
  lineDelayMs?: number;
}

export function useLineByLineTypewriter(
  items: ChecklistItem[] | null | undefined,
  enabledOrOptions: boolean | LineTypewriterOptions = true,
  legacySpeedMs?: number
) {
  const options: LineTypewriterOptions =
    typeof enabledOrOptions === "boolean"
      ? { enabled: enabledOrOptions, speedMs: legacySpeedMs ?? 25, lineDelayMs: 900 }
      : { enabled: true, speedMs: 25, lineDelayMs: 900, ...enabledOrOptions };

  const { enabled = true, speedMs = 25, lineDelayMs = 900 } = options;

  const reduceMotion = useReducedMotion() ?? false;
  const shouldAnimate = enabled && !reduceMotion && Boolean(items && items.length > 0);

  const [state, setState] = useState<TypewriterState>(() => ({
    completedIndex: shouldAnimate ? 0 : (items?.length ?? 0),
    currentText: "",
  }));

  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Sync state if animation preference changes or when items change
  useEffect(() => {
    if (!shouldAnimate) {
      setState({
        completedIndex: items?.length ?? 0,
        currentText: "",
      });
    }
  }, [items, shouldAnimate]);

  useEffect(() => {
    if (!shouldAnimate || !items || items.length === 0) return;
    if (state.completedIndex >= items.length) return;

    const currentItem = items[state.completedIndex];
    if (!currentItem) return;

    const fullLabel = currentItem.label;
    const tokens = fullLabel.split(/(\s+)/);
    let tokenIdx = 0;
    let acc = "";

    intervalRef.current = window.setInterval(() => {
      acc += tokens[tokenIdx] ?? "";
      tokenIdx += 1;

      setState((prev) => ({
        ...prev,
        currentText: acc,
      }));

      if (tokenIdx >= tokens.length) {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Time gap delay before advancing to the next checklist line
        timeoutRef.current = window.setTimeout(() => {
          setState((prev) => ({
            completedIndex: prev.completedIndex + 1,
            currentText: "",
          }));
        }, lineDelayMs);
      }
    }, speedMs);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [state.completedIndex, items, shouldAnimate, speedMs, lineDelayMs]);

  if (!items || items.length === 0) {
    return { visibleItems: [], isFinished: true };
  }

  if (!shouldAnimate) {
    return {
      visibleItems: items.map((item) => ({
        item,
        displayText: item.label,
        isTyping: false,
      })),
      isFinished: true,
    };
  }

  const visibleItems = items.slice(0, state.completedIndex + 1).map((item, idx) => {
    const isCurrent = idx === state.completedIndex;
    const isCompletedLine = idx < state.completedIndex;
    return {
      item,
      displayText: isCompletedLine ? item.label : state.currentText,
      isTyping: isCurrent && state.completedIndex < items.length,
    };
  });

  return {
    visibleItems,
    isFinished: state.completedIndex >= items.length,
  };
}
