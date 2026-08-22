'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useReducedMotion, AnimatePresence, motion } from 'framer-motion'

import type { ChecklistItem } from './types'

interface TypewriterState {
  completedIndex: number
  currentText: string
  isFinished: boolean
}

export interface LineTypewriterOptions {
  /** Whether the typing animation is enabled. */
  enabled?: boolean

  /** Delay between each word/token. */
  speedMs?: number

  /** Delay after one line finishes before the next line starts. */
  lineDelayMs?: number

  /** Use spring physics for smoother animations */
  spring?: boolean

  /** Stagger delay between checklist items */
  staggerDelay?: number
}

/**
 * Enhanced line-by-line typewriter with spring physics and stagger effects
 */
export function useLineByLineTypewriter(
  items: ChecklistItem[] | null | undefined,
  enabledOrOptions: boolean | LineTypewriterOptions = true,
  legacySpeedMs?: number
) {
  const options: LineTypewriterOptions =
    typeof enabledOrOptions === 'boolean'
      ? {
          enabled: enabledOrOptions,
          speedMs: legacySpeedMs ?? 25,
          lineDelayMs: 900,
          spring: true,
          staggerDelay: 50,
        }
      : {
          enabled: true,
          speedMs: 100,
          lineDelayMs: 900,
          spring: enabledOrOptions.spring ?? true,
          staggerDelay: enabledOrOptions.staggerDelay ?? 50,
          ...enabledOrOptions,
        }

  const {
    enabled = true,
    speedMs = 25,
    lineDelayMs = 900,
    spring = true,
    staggerDelay = 50,
  } = options

  const reduceMotion = useReducedMotion() ?? false

  // Disable special animations when reduced motion is enabled
  const shouldAnimate =
    enabled &&
    !reduceMotion &&
    Boolean(items && items.length > 0)

  /*
   * Important:
   * This gives the checklist a stable identity based on its
   * actual contents rather than the array reference.
   */
  const checklistKey = useMemo(() => {
    if (!items || items.length === 0) {
      return ''
    }

    return items
      .map((item) => `${item.id}:${item.label}`)
      .join('|')
  }, [items])

  const [state, setState] = useState<TypewriterState>(() => ({
    completedIndex: shouldAnimate
      ? 0
      : items?.length ?? 0,
    currentText: '',
    isFinished: !shouldAnimate && (items?.length ?? 0) > 0,
  }))

  const [previousChecklistKey, setPreviousChecklistKey] = useState(checklistKey)
  const [previousShouldAnimate, setPreviousShouldAnimate] = useState(shouldAnimate)

  /*
   * Reset animation when the actual checklist changes or when shouldAnimate becomes true.
   */
  useEffect(() => {
    if (shouldAnimate && !previousShouldAnimate) {
      setPreviousShouldAnimate(shouldAnimate)
      setState({
        completedIndex: 0,
        currentText: '',
        isFinished: false,
      })
      return
    }
    setPreviousShouldAnimate(shouldAnimate)

    if (previousChecklistKey === checklistKey) {
      return
    }

    setPreviousChecklistKey(checklistKey)

    setState({
      completedIndex: shouldAnimate
        ? 0
        : items?.length ?? 0,
      currentText: '',
      isFinished: !shouldAnimate && (items?.length ?? 0) > 0,
    })
  }, [
    checklistKey,
    previousChecklistKey,
    shouldAnimate,
    previousShouldAnimate,
    items?.length,
  ])

  /*
   * When animation is disabled, show everything immediately.
   */
  useEffect(() => {
    if (!shouldAnimate) {
      setState({
        completedIndex: items?.length ?? 0,
        currentText: '',
        isFinished: true,
      })
    }
  }, [shouldAnimate, items?.length])

  /*
   * TYPE CURRENT LINE — human-like variable-speed engine
   *
   * Each token gets its own delay computed from its content:
   *  • Whitespace / short words (≤2 chars) / punctuation → burst (fast)
   *  • Long words (≥9 chars) → slightly slower
   *  • Sentence-ending punctuation (.!?) → extra 180–430 ms pause
   *  • Commas / semicolons → extra 60–140 ms pause
   *  • ±20% random variation applied to every token
   *  • A short 80–200 ms "thinking" pause fires before typing begins
   */
  useEffect(() => {
    if (!shouldAnimate) return
    if (!items || items.length === 0) return
    if (state.completedIndex >= items.length) return

    const currentItem = items[state.completedIndex]
    if (!currentItem) return

    const tokens = currentItem.label.split(/(\s+)/)
    let tokenIndex = 0
    let currentText = ''
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    /** Compute how long to wait before revealing this token. */
    function computeDelay(token: string): number {
      const trimmed = token.trim()

      // Classify the token
      const isBurst =
        trimmed.length === 0 ||
        trimmed.length <= 2 ||
        /^[!?,.:;—–•*]/.test(trimmed)
      const isLong = trimmed.length >= 9

      let delay = speedMs
      if (isBurst) delay = Math.max(12, Math.floor(speedMs * 0.45))
      else if (isLong) delay = Math.floor(speedMs * 1.5)

      // ±20% random variation per token
      delay = Math.floor(delay * (0.8 + Math.random() * 0.4))

      // Extra pause after sentence-ending punctuation
      if (/[.!?]$/.test(trimmed)) {
        delay += 180 + Math.floor(Math.random() * 250)
      } else if (/[,;]$/.test(trimmed)) {
        // Slight comma / semicolon breath
        delay += 60 + Math.floor(Math.random() * 80)
      }

      return Math.max(12, delay)
    }

    /** Recursively schedule the next token. */
    function scheduleNext() {
      if (cancelled) return

      // All tokens for this line are typed — wait then advance to next item.
      if (tokenIndex >= tokens.length) {
        timeoutId = setTimeout(() => {
          if (cancelled) return
          setState((previous) => ({
            completedIndex: previous.completedIndex + 1,
            currentText: '',
            isFinished:
              previous.completedIndex + 1 >= (items?.length ?? 0),
          }))
        }, lineDelayMs)
        return
      }

      const token = tokens[tokenIndex]
      const delay = computeDelay(token)
      tokenIndex++

      timeoutId = setTimeout(() => {
        if (cancelled) return
        currentText += token
        setState((previous) => ({ ...previous, currentText }))
        scheduleNext()
      }, delay)
    }

    // "Thinking" pause before Luna starts typing each new line
    timeoutId = setTimeout(
      scheduleNext,
      80 + Math.floor(Math.random() * 120)
    )

    /*
     * Cleanup whenever the current line changes or the component unmounts.
     */
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [
    state.completedIndex,
    checklistKey,
    shouldAnimate,
    speedMs,
    lineDelayMs,
  ])

  /*
   * No checklist.
   */
  if (!items || items.length === 0) {
    return {
      visibleItems: [],
      isFinished: true,
    }
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
    }
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
        index === state.completedIndex

      const isCompleted =
        index < state.completedIndex

      return {
        item,

        displayText: isCompleted
          ? item.label
          : state.currentText,

        isTyping:
          isCurrent &&
          state.completedIndex < items.length,
      }
    })

  return {
    visibleItems,
    isFinished:
      state.completedIndex >= items.length,
    shouldAnimate,
    checklistKey,
  }
}

/**
 * Checklist card component with premium animations and spring physics
 */
export function ChecklistCard({ item, displayText, isTyping }: any) {
  // Item entrance animation with spring physics
  const itemVariants = {
    hidden: {
      opacity: 0,
      x: -10,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        type: 'spring' as const,
        stiffness: 400,
        damping: 25,
      },
    },
  }

  return (
    <motion.li
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="group flex items-baseline gap-2"
    >
      {/* Number badge with entry animation */}
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 20,
          delay: 0.1,
        }}
        className="font-semibold text-emerald-600 dark:text-emerald-400"
      >
        {item.number}.
      </motion.span>

      {/* Item text with smooth typing animation */}
      <motion.span
        key={displayText}
        className="relative"
      >
        {displayText}
        {isTyping && (
          <motion.span
            key="cursor"
            className="ml-0.5 align-middle"
            animate={{
              opacity: [1, 0.4, 1],
              scale: [1.2, 0.8, 1.2],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <span className="inline-block size-[2px] animate-pulse rounded-sm bg-emerald-500 align-middle dark:bg-emerald-400" />
          </motion.span>
        )}

        {/* Shimmer effect on completed items */}
        {displayText === item.label && (
          <motion.div
            className="absolute inset-0 -z-10 -translate-y-1/2 translate-x-1/4 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent"
            initial={{ width: 0 }}
            animate={{ width: '200%' }}
            transition={{
              duration: 1.5,
              delay: 0.3,
              ease: 'easeInOut',
            }}
            style={{ filter: 'blur(8px)' }}
          />
        )}
      </motion.span>
    </motion.li>
  )
}

/**
 * Checklist container with premium card styling
 */
export function ChecklistContainer({ children, className = '' }: any) {
  return (
    <motion.ul
      className={`space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.3,
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {children}
      </AnimatePresence>
    </motion.ul>
  )
}