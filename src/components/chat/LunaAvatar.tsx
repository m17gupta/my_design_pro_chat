"use client"

import { motion, useReducedMotion } from "framer-motion"

const LUNA_LOGO = "https://mydesigns.pro/img/luna-logo.jpg"

interface LunaAvatarProps {
  size?: "sm" | "md"
  /** Show a soft pulsing ring while Luna is "typing" */
  pulse?: boolean
  /** Show ambient ambient effects */
  ambient?: boolean
  /** Custom confidence level for visual feedback */
  confidence?: number
}

export default function LunaAvatar({
  size = "md",
  pulse = false,
  ambient = true,
  confidence = 85
}: LunaAvatarProps) {
  const reduceMotion = useReducedMotion()
  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10"

  // Generate random breathing dots positions
  const breathingDots = Array.from({ length: 4 }, (_, i) => ({
    id: i,
    pos: i % 2 === 0 ? 'top' : 'bottom',
    delay: i * 0.25,
    offset: (i % 2 === 0 ? -3 : 3) * 0.5
  }))

  return (
    <div
      className={`relative ${dims} shrink-0`}
      aria-hidden="true"
    >
      {/* Ambient breathing dots */}
      {ambient && !reduceMotion && (
        <div className="absolute inset-0">
          {breathingDots.map((dot) => (
            <motion.div
              key={dot.id}
              className="absolute -translate-y-1/2 rounded-full bg-gradient-to-br from-emerald-400/80 to-emerald-600/80"
              style={{
                left: '50%',
                [dot.pos]: `${dot.offset}px`,
                width: '2px',
                height: '2px',
              }}
              initial={{
                opacity: 0,
                scale: 0.5,
              }}
              animate={{
                opacity: [0, 0.6, 0.3, 0],
                scale: [0.5, 1, 0.7, 0.5],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: dot.delay,
              }}
            >
              {/* Inner glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-500"
                initial={{ opacity: 0.3 }}
                animate={{
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: dot.delay,
                }}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Main pulse ring */}
      {pulse && !reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full ring-2 ring-emerald-400/70"
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{
            opacity: [0.7, 0, 0.7],
            scale: [1, 1.22, 1],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Layered rings for depth */}
          <motion.span
            className="absolute inset-0 rounded-full ring-1.5 ring-emerald-500/50"
            initial={{ opacity: 0.5, scale: 1.05 }}
            animate={{
              opacity: [0.5, 0, 0.5],
              scale: [1.05, 1.3, 1.05],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3,
            }}
          />
        </motion.span>
      )}

      {/* Confidence glow level based on confidence level */}
      {!reduceMotion && confidence && (
        <motion.div
          className={`absolute inset-0 rounded-full ${confidence >= 75 ? 'ring-2 ring-emerald-500/80' : confidence >= 50 ? 'ring-2 ring-amber-500/70' : 'ring-2 ring-red-500/60'}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: confidence >= 75 ? 0.4 : confidence >= 50 ? 0.25 : 0.15,
            scale: [0, 1.15, 1],
          }}
          transition={{
            duration: 0.5,
            ease: "easeOut",
            opacity: {
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2,
            },
            scale: {
              duration: 1.8,
              repeat: Infinity,
              repeatDelay: 2,
            },
          }}
        />
      )}

      {/* Subtle background glow */}
      {!reduceMotion && (
        <motion.div
          className="absolute inset-0 rounded-full blur-md"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: confidence >= 75 ? 0.15 : confidence >= 50 ? 0.1 : 0.05,
          }}
          transition={{
            duration: 1,
            ease: "easeInOut",
            opacity: {
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1,
            },
          }}
          style={{
            background: confidence >= 75
              ? 'radial-gradient(circle, #10b98130 0%, transparent 70%)'
              : confidence >= 50
              ? 'radial-gradient(circle, #f59e0b20 0%, transparent 70%)'
              : 'radial-gradient(circle, #ef444420 0%, transparent 70%)',
          }}
        />
      )}

      {/* Main avatar container */}
      <div
        className={`message-card-backdrop relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white shadow-md shadow-emerald-500/25 ${confidence >= 75 ? 'shadow-lg' : confidence >= 50 ? 'shadow-md' : 'shadow-sm'}`}
      >
        {/* Stack layer ring for premium feel */}
        {!reduceMotion && (
          <motion.div
            className="absolute inset-0.5 rounded-full border border-emerald-500/20"
            initial={{ opacity: 0.5 }}
            animate={{
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1,
            }}
          />
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LUNA_LOGO}
          alt=""
          className="h-full w-full object-cover"
        />

        {/* Subtle shimmer on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        />
      </div>
    </div>
  )
}