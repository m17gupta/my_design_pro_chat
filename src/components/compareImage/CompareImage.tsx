"use client";

import { RootState } from "@/store";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useSelector } from "react-redux";

export interface CompareImageProps {
  /** Input image URL (shown on the right side: Original property) */
  inputImage?: string;
  /** Output image URL (shown on the left side: Generated proposal) */
  outputImage?: string;
  /** Label for output image (default: "Generated proposal") */
  outputLabel?: string;
  /** Label for input image (default: "Original property") */
  inputLabel?: string;
  /** Initial slider position in percent (0 to 100, default: 50) */
  initialSliderPosition?: number;
  /** Custom class name for outer wrapper */
  className?: string;
}

export default function CompareImage({
  inputImage,
  outputImage,
  outputLabel = "Generated proposal",
  inputLabel = "Original property",
  initialSliderPosition = 50,
  className = "",
}: CompareImageProps) {
  const [sliderPosition, setSliderPosition] = useState(initialSliderPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [inputLoaded, setInputLoaded] = useState(!inputImage);
  const [outputLoaded, setOutputLoaded] = useState(!outputImage);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const resolvedInputImage = inputImage || undefined;
  const resolvedOutputImage = outputImage || undefined;

  useEffect(() => {
    setInputLoaded(!inputImage);
  }, [inputImage]);

  useEffect(() => {
    setOutputLoaded(!outputImage);
  }, [outputImage]);

  const isImagesLoading =
    (!inputLoaded && !!resolvedInputImage) ||
    (!outputLoaded && !!resolvedOutputImage) ||
    (!resolvedInputImage && !resolvedOutputImage);

  const updatePosition = useCallback((clientX: number, targetElem: HTMLElement | null) => {
    if (!targetElem) return;
    const rect = targetElem.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSliderPosition(Math.round(percent * 10) / 10);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    updatePosition(e.clientX, containerRef.current);
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    updatePosition(e.clientX, trackRef.current);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      // Prioritize container bounds for accurate scrub
      const target = containerRef.current || trackRef.current;
      if (target) {
        updatePosition(e.clientX, target);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, updatePosition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setSliderPosition((prev) => Math.max(0, prev - 2));
    } else if (e.key === "ArrowRight") {
      setSliderPosition((prev) => Math.min(100, prev + 2));
    }
  };

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Image comparison viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="group relative aspect-[16/10] sm:aspect-[16/9] w-full cursor-ew-resize overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-950 shadow-sm dark:border-zinc-800 touch-none"
      >
        {/* Loading Overlay */}
        {isImagesLoading && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950/75 backdrop-blur-sm transition-opacity duration-200">
            <div className="flex flex-col items-center gap-2.5">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-500" />
              <span className="text-xs font-medium text-white/90">Loading comparison images...</span>
            </div>
          </div>
        )}

        {/* Left Side Label (Generated proposal) */}
        <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center rounded-md bg-[#222b35]/85 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm">
          {outputLabel}
        </div>

        {/* Right Side Label (Original property) */}
        <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center rounded-md bg-[#222b35]/85 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm">
          {inputLabel}
        </div>

        {/* Background Image: Original property (revealed on the right side) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedInputImage}
          alt={inputLabel}
          loading="lazy"
          decoding="async"
          onLoad={() => setInputLoaded(true)}
          onError={() => setInputLoaded(true)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover select-none transition-opacity duration-300 ${
            inputLoaded ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Foreground Image: Generated proposal (clipped to sliderPosition on left side) */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedOutputImage}
            alt={outputLabel}
            loading="lazy"
            decoding="async"
            onLoad={() => setOutputLoaded(true)}
            onError={() => setOutputLoaded(true)}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover select-none transition-opacity duration-300 ${
              outputLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        {/* Vertical divider line */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)]"
          style={{ left: `${sliderPosition}%` }}
        />
      </div>

      {/* Bottom Range Slider (matching Screenshot 2) */}
      <div className="mt-3 px-1">
        <div
          ref={trackRef}
          role="slider"
          aria-label="Image comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={handleTrackPointerDown}
          className="relative flex h-5 w-full cursor-pointer items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d6b] rounded-full"
        >
          {/* Inactive Track Background (Right side border/track) */}
          <div className="h-1.5 w-full rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />

          {/* Active Track Fill (Left side solid teal/green, #2e7d6b) */}
          <div
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-l-full bg-[#2e7d6b]"
            style={{ width: `${sliderPosition}%` }}
          />

          {/* Slider Thumb Handle */}
          <div
            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2e7d6b] shadow-md transition-transform duration-75 ${
              isDragging ? "scale-125" : "hover:scale-110"
            }`}
            style={{ left: `${sliderPosition}%` }}
          />
        </div>
      </div>
    </div>
  );
}
