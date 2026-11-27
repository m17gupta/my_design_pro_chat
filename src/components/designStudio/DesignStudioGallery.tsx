"use client";

import React from "react";
import { DEMO_HOUSE_SVG, type DesignVersion } from "./types";

interface DesignStudioGalleryProps {
  versions: DesignVersion[];
  activeVersionId: string | undefined;
  selectedCount: number;
  onSelectActive: (id: string) => void;
  onToggleSelected: (id: string, e: React.MouseEvent) => void;
  onSendToDc: () => void;
}

/** Bottom section: generated design versions gallery with multi-select and Send to DC action. */
export function DesignStudioGallery({
  versions,
  activeVersionId,
  selectedCount,
  onSelectActive,
  onToggleSelected,
  onSendToDc,
}: DesignStudioGalleryProps) {
  return (
    <section className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Luna Design Gallery
            </p>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Design versions</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                {versions.length} {versions.length === 1 ? "version" : "versions"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={onSendToDc}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2e7d47] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#25663a]"
          >
            <i className="bi bi-send-fill text-[11px]" />
            Send to DC
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {versions.map((ver) => {
          const isActive = ver.id === activeVersionId;
          return (
            <div
              key={ver.id}
              onClick={() => onSelectActive(ver.id)}
              className={`group cursor-pointer overflow-hidden rounded-xl border bg-white transition ${
                ver.selected
                  ? "border-[#4338ca] ring-1 ring-[#4338ca]/30"
                  : "border-slate-200 hover:border-slate-300"
              } ${isActive ? "shadow-md" : "shadow-2xs"}`}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ver.imageUrl || DEMO_HOUSE_SVG}
                  alt={ver.title}
                  onError={(e) => {
                    e.currentTarget.src = DEMO_HOUSE_SVG;
                  }}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />

                {/* Top-left Selected Toggle */}
                <button
                  type="button"
                  onClick={(e) => onToggleSelected(ver.id, e)}
                  className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold shadow-xs transition ${
                    ver.selected
                      ? "bg-[#3b32a8] text-white"
                      : "bg-white/90 text-slate-700 hover:bg-white"
                  }`}
                >
                  <i
                    className={`bi ${
                      ver.selected ? "bi-check-square-fill" : "bi-square"
                    } text-xs`}
                  />
                  {ver.selected ? "Selected" : "Select"}
                </button>

                {(ver.status === "generating" || ver.status === "polling") && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/35 text-white">
                    <i className="bi bi-arrow-repeat animate-spin text-xl" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-3 py-2.5">
                <p className="truncate text-xs font-semibold text-slate-800">
                  Version {ver.versionNumber} &middot; {ver.badge}
                </p>
                {isActive && (
                  <span className="text-[10px] font-semibold text-indigo-600">
                    Viewing
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
