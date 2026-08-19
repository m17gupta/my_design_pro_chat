"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ChecklistItem } from "./types";

interface TypewriterState {
  completedIndex: number;
  currentText: string;
}

export interface LineTypewriterOptions {
  /** Whether the typing animation is enabled. */
  enabled?: boolean;

  /** Delay between each word/token. */
  speedMs?: number;

  /** Delay after one line finishes before the next line starts. */
  lineDelayMs?: number;
}

export function useLineByLineTypewriter(
  items: ChecklistItem[] | null | undefined,
  enabledOrOptions: boolean | LineTypewriterOptions = true,
  legacySpeedMs?: number
) {
  const options: LineTypewriterOptions =
    typeof enabledOrOptions === "boolean"
      ? {
          enabled: enabledOrOptions,
          speedMs: legacySpeedMs ?? 25,
          lineDelayMs: 900,
        }
      : {
          enabled: true,
          speedMs: 100,
          lineDelayMs: 900,
          ...enabledOrOptions,
        };

  const {
    enabled = true,
    speedMs = 25,
    lineDelayMs = 900,
  } = options;

  const reduceMotion = useReducedMotion() ?? false;

  const shouldAnimate =
    enabled &&
    !reduceMotion &&
    Boolean(items && items.length > 0);

  /*
   * Important:
   * This gives the checklist a stable identity based on its
   * actual contents rather than the array reference.
   */
  const checklistKey = useMemo(() => {
    if (!items || items.length === 0) {
      return "";
    }

    return items
      .map((item) => `${item.id}:${item.label}`)
      .join("|");
  }, [items]);

  const [state, setState] = useState<TypewriterState>(() => ({
    completedIndex: shouldAnimate
      ? 0
      : items?.length ?? 0,
    currentText: "",
  }));

  const [previousChecklistKey, setPreviousChecklistKey] =
    useState(checklistKey);
  const [previousShouldAnimate, setPreviousShouldAnimate] =
    useState(shouldAnimate);

  /*
   * Reset animation when the actual checklist changes or when shouldAnimate becomes true.
   */
  useEffect(() => {
    if (shouldAnimate && !previousShouldAnimate) {
      setPreviousShouldAnimate(shouldAnimate);
      setState({
        completedIndex: 0,
        currentText: "",
      });
      return;
    }
    setPreviousShouldAnimate(shouldAnimate);

    if (previousChecklistKey === checklistKey) {
      return;
    }

    setPreviousChecklistKey(checklistKey);

    setState({
      completedIndex: shouldAnimate
        ? 0
        : items?.length ?? 0,
      currentText: "",
    });
  }, [
    checklistKey,
    previousChecklistKey,
    shouldAnimate,
    previousShouldAnimate,
    items?.length,
  ]);

  /*
   * When animation is disabled, show everything immediately.
   */
  useEffect(() => {
    if (!shouldAnimate) {
      setState({
        completedIndex: items?.length ?? 0,
        currentText: "",
      });
    }
  }, [shouldAnimate, items?.length]);

  /*
   * TYPE CURRENT LINE
   *
   * Only one checklist item is processed at a time.
   */
  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    if (!items || items.length === 0) {
      return;
    }

    if (state.completedIndex >= items.length) {
      return;
    }

    const currentItem = items[state.completedIndex];

    if (!currentItem) {
      return;
    }

    const tokens = currentItem.label.split(/(\s+)/);

    let tokenIndex = 0;
    let currentText = "";

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    intervalId = setInterval(() => {
      /*
       * Add one word/space at a time.
       */
      if (tokenIndex < tokens.length) {
        currentText += tokens[tokenIndex];
        tokenIndex++;

        setState((previous) => ({
          ...previous,
          currentText,
        }));
      }

      /*
       * Current line is completely typed.
       */
      if (tokenIndex >= tokens.length) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }

        /*
         * Wait before starting the next line.
         */
        timeoutId = setTimeout(() => {
          setState((previous) => ({
            completedIndex:
              previous.completedIndex + 1,
            currentText: "",
          }));
        }, lineDelayMs);
      }
    }, speedMs);

    /*
     * Cleanup whenever the current line changes
     * or the component unmounts.
     */
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    state.completedIndex,
    checklistKey,
    shouldAnimate,
    speedMs,
    lineDelayMs,
  ]);

  /*
   * No checklist.
   */
  if (!items || items.length === 0) {
    return {
      visibleItems: [],
      isFinished: true,
    };
  }

  /*
   * Animation disabled or reduced motion enabled.
   */
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

  /*
   * Only show:
   *
   * 1. Previously completed lines
   * 2. Current line being typed
   *
   * Future lines remain hidden.
   */
  const visibleItems = items
    .slice(0, state.completedIndex + 1)
    .map((item, index) => {
      const isCurrent =
        index === state.completedIndex;

      const isCompleted =
        index < state.completedIndex;

      return {
        item,

        displayText: isCompleted
          ? item.label
          : state.currentText,

        isTyping:
          isCurrent &&
          state.completedIndex < items.length,
      };
    });

  return {
    visibleItems,
    isFinished:
      state.completedIndex >= items.length,
  };
}