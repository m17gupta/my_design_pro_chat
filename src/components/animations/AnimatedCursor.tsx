'use client'

import { motion, useMotionTemplate } from 'framer-motion'

/**
 * Enhanced cursor component for typing effects
 * Provides realistic cursor behavior with pause forms and contextual variations
 */

export interface AnimatedCursorProps {
  /** Whether the cursor is currently active */
  isActive: boolean
  /** Current speed in ms per character (for visual feedback) */
  currentSpeed: number
  /** Array of pause positions and their types */
  pauses?: Array<{ position: number; duration: number; type: string }>
  /** Theme color for cursor (default: emerald) */
  color?: 'emerald' | 'teal' | 'purple' | 'slate'
  /** Show pause indicators during typing */
  showPauses?: boolean
  /** Cursor size multiplier */
  sizeMultiplier?: number
}

export const AnimatedCursor = ({
  isActive,
  currentSpeed,
  pauses = [],
  color = 'emerald',
  showPauses = true,
  sizeMultiplier = 1,
}: AnimatedCursorProps) => {
  // Map colors to Tailwind classes
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-500 dark:bg-emerald-400',
      border: 'border-emerald-500 dark:border-emerald-400',
    },
    teal: {
      bg: 'bg-teal-500 dark:bg-teal-400',
      border: 'border-teal-500 dark:border-teal-400',
    },
    purple: {
      bg: 'bg-purple-500 dark:bg-purple-400',
      border: 'border-purple-500 dark:border-purple-400',
    },
    slate: {
      bg: 'bg-zinc-400 dark:bg-zinc-500',
      border: 'border-zinc-400 dark:border-zinc-500',
    },
  }

  const colors = colorMap[color]

  // Calculate cursor state based on speed
  const isFast = currentSpeed <= 18
  const isSlow = currentSpeed >= 25
  const isNormal = currentSpeed >= 18 && currentSpeed < 25

  return (
    <motion.span
      layoutId="cursor"
      className={`inline-block h-[calc(1em*${sizeMultiplier})] w-[calc(2px*${sizeMultiplier})] rounded-sm align-middle ${colors.bg} ${showPauses ? 'animate-pulse' : 'opacity-0'}`}
      animate={{
        opacity: 0,
        scale: [0.6, 1, 0.8, 1],
        width: [1.5, 2.5, 2, 2.5],
      }}
      transition={{
        duration: 0.3,
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {/* Speed indicator gauge */}
      {/* Show varying speed indicators based on current typing speed */}
      <motion.div
        className="absolute -top-1 -left-8 flex items-center gap-1"
        initial={false}
        animate={{
          opacity: isFast ? 1 : isSlow ? 0.5 : 0.7,
          scale: isNormal ? 1 : isFast ? 1.2 : 0.8,
        }}
      >
        {/* Fast typing indicator */}
        {isFast && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
        {/* Normal typing indicator */}
        {isNormal && (
          <motion.div
            className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
        {/* Slow typing indicator */}
        {isSlow && <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
      </motion.div>

      {/* Background glow effect */}
      <motion.div
        className={`absolute -right-2 -bottom-2 -z-10 h-4 w-4 rounded-full bg-emerald-500/20 blur-sm ${colors.bg}`}
        initial={false}
        animate={{
          scale: [0, 2, 0.5, 1.5],
          opacity: [0, 0.6, 0.3, 0.8],
        }}
        transition={{
          duration: 0.5,
          type: 'spring',
          repeat: Infinity,
          repeatDelay: 2,
        }}
      />

      {/* Pulse indicator when isTyping */}
      {isActive && showPauses && (
        <motion.div
          className={`absolute right-0 top-0.5 h-0.5 w-3 rounded ${colors.border}`}
          animate={{
            scaleX: [1, 1.3, 1],
            opacity: [1, 0.7, 1],
          }}
          transition={{
            duration: 0.5,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.span>
  )
}

/**
 * Smart pause indicator that appears during typing pauses
 */
export interface PauseIndicatorProps {
  /** Current position in typing flow */
  position: number
  /** Type of pause (sentence, thought, breather, final) */
  type?: 'sentence' | 'thought' | 'breather' | 'final'
  /** Show indicator during long pauses (>300ms) */
  showDuringLongPauses?: boolean
  /** Maximum pause duration to show indicators */
  maxPauseDuration?: number
}

export const PauseIndicator = ({
  position,
  type = 'sentence',
  showDuringLongPauses = true,
  maxPauseDuration = 400,
}: PauseIndicatorProps) => {
  const pauseDurations: Record<string, string> = {
    sentence:
      showDuringLongPauses
        ? '⏳' // Thought pause
        : '',
    thought: '🤔', // Deep thought
    breather: '...', // End-of-thought pause
    final: '✓', // Final finish
  }

  if (!pauseDurations[type] || !showDuringLongPauses) {
    return null
  }

  return (
    <motion.div
      className="inline-flex items-center gap-0.5 text-sm text-zinc-400 dark:text-zinc-600"
      initial={{ opacity: 0, y: -5, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        duration: 0.3,
        type: 'spring',
        stiffness: 400,
        damping: 20,
      }}
    >
      <span className="invisible">
        {position}
      </span>
      {pauseDurations[type]}
    </motion.div>
  )
}

/**
 * Confidence badge shown before typing starts
 */
export interface ConfidenceBadgeProps {
  /** Show confidence badge before typing */
  show?: boolean
  /** Confidence level (0-100) */
  confidence?: number
  /** On hover, show detailed confidence breakdown */
  showDetail?: boolean
}

export const ConfidenceBadge = ({
  show = true,
  confidence = 80,
  showDetail = false,
}: ConfidenceBadgeProps) => {
  if (!show) {
    return null
  }

  const confidenceColorMap = {
    high: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    low: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }

  const confidenceLevel =
    confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low'

  return (
    <motion.div
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium pulse-soft ${confidenceColorMap[confidenceLevel]}`}
      initial={{ opacity: 0, scale: 0.8, y: -5 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      transition={{
        duration: 0.4,
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      whileHover={showDetail ? { scale: 1.05 } : undefined}
    >
      <span className="flex h-1.5 w-1.5 items-center justify-center rounded-full bg-current">
        <motion.div
          className="h-full w-full rounded-full"
          animate={{
            scale: [0.5, 1.3, 0.5],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        />
      </span>
      {confidence}% confidence
    </motion.div>
  )
}

/**
 * Breathing indicator for more contextual typing effects
 */
export const TypingBreathIndicator = ({
  show,
  intensity = 'normal',
}: {
  show: boolean
  intensity: 'gathering' | 'normal' | 'focused' | 'excited'
}) => {
  if (!show) {
    return null
  }

  const bubblePositions = [
    { left: '-2px', top: '2px' },
    { left: '2px', top: '-1px' },
    { left: '-1px', top: '-2px' },
    { left: '1px', top: '1px' },
  ]

  const bubbleSizes = {
    gathering: 'h-2 w-2',
    normal: 'h-2 w-2',
    focused: 'h-2 w-2',
    excited: 'h-2 w-2',
  }

  return (
    <div className="relative h-3 w-3">
      {bubblePositions.map((pos, index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 ${bubbleSizes[intensity]}`}
          animate={{
            opacity: [0, 0.6, 0.3, 0],
            scale: [0.5, 1, 0.7, 0.5],
            x: 0,
            y: 0,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 0.5,
            delay: index * 0.2,
            ease: 'easeInOut',
          }}
          style={{
            left: pos.left,
            top: pos.top,
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-500"
            animate={{
              scale: [0.5, 1.5, 0.5],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: index * 0.3,
              ease: 'easeInOut',
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

/**
 * Works with produce type and handled inline
 */
type AnimatedCursorReturn = ReturnType<typeof AnimatedCursor>
