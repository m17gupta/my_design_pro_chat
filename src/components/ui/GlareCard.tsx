"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";

interface GlareCardProps {
  children: React.ReactNode;
  className?: string;
  /** Disable tilt/glare (e.g. on mobile / reduced-motion). Default false. */
  disabled?: boolean;
}

/**
 * Aceternity-style Glare Card
 *
 * • Mouse-tracking 3-D tilt via Framer Motion springs
 * • Diagonal glare overlay that follows cursor X position
 * • Subtle glow-pulse border ring on idle
 * • Fully accessible — tilt is purely cosmetic, no focus trapping
 */
export default function GlareCard({
  children,
  className = "",
  disabled = false,
}: GlareCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Raw mouse positions (0 → 1 relative to card)
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Spring-smoothed values for buttery motion
  const springConfig = { stiffness: 220, damping: 26, mass: 0.6 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Map to tilt angles (±8°)
  const rotateY = useTransform(smoothX, [0, 1], [-8, 8]);
  const rotateX = useTransform(smoothY, [0, 1], [8, -8]);

  // Glare moves horizontally across the card
  const glareX = useTransform(smoothX, [0, 1], [-60, 160]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }

  function onMouseLeave() {
    setIsHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={onMouseLeave}
      style={
        disabled
          ? {}
          : {
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
              transformPerspective: 900,
            }
      }
      className={`glare-card relative overflow-hidden rounded-2xl glow-pulse ${className}`}
    >
      {children}

      {/* ── Glare overlay ── */}
      {!disabled && isHovered && (
        <motion.div
          aria-hidden="true"
          style={{ x: glareX }}
          className="
            pointer-events-none
            absolute inset-0
            h-full w-[45%]
            bg-gradient-to-r
            from-transparent
            via-white/14
            to-transparent
            skew-x-[-20deg]
          "
        />
      )}
    </motion.div>
  );
}
