"use client";

import React, { useState } from "react";
import CompareImage from "@/components/compareImage";
import { DEMO_HOUSE_SVG, type ApiEndpoint, type DesignVersion } from "./types";
import type { DesignerPallet } from "@/store/designerGenerate/designerGenerateType";

interface DesignStudioOutputProps {
  activeVersion: DesignVersion | null;
  endpoint: ApiEndpoint;
  lightboxOpen: boolean;
  onOpenLightbox: () => void;
  onCloseLightbox: () => void;
  onResetDemo: () => void;
}

/** Right column output panel: active design preview, overlays, status/error banners, and lightbox. */
export function DesignStudioOutput({
  activeVersion,
  endpoint,
  lightboxOpen,
  onOpenLightbox,
  onCloseLightbox,
  onResetDemo,
}: DesignStudioOutputProps) {
  const [selectedPallet, setSelectedPallet] = useState<DesignerPallet | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);

  const originalImageUrl = activeVersion?.originalImageUrl?.trim() || "";
  const generatedImageUrl = activeVersion?.imageUrl?.trim() || "";
  const canCompare = Boolean(
    activeVersion &&
      !activeVersion.isDemo &&
      activeVersion.status === "completed" &&
      originalImageUrl &&
      generatedImageUrl &&
      originalImageUrl !== generatedImageUrl
  );
  const showCompare = isCompareMode && canCompare;

  const palletsWithImages = (activeVersion?.pallets ?? []).filter(
    (p): p is DesignerPallet & { image: string } =>
      typeof p.image === "string" && p.image.trim().length > 0
  );

  return (
    <>
      <div className="lg:col-span-7">
        <section className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          {/* Preview Header */}
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Luna AI Studio
              </p>
              <h2 className="text-base font-bold text-slate-900">Design preview</h2>
            </div>

            <div className="flex items-center gap-2">
              {canCompare && (
                <button
                  type="button"
                  onClick={() => setIsCompareMode((prev) => !prev)}
                  title={showCompare ? "Switch back to preview" : "Compare original vs generated image"}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    showCompare
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-xs hover:bg-indigo-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  }`}
                >
                  <i className="bi bi-layout-split text-xs" />
                  <span>{showCompare ? "Compare On" : "Compare"}</span>
                </button>
              )}
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  activeVersion?.status === "failed"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : activeVersion?.isDemo
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-indigo-200 bg-indigo-50 text-indigo-700"
                }`}
              >
                {activeVersion?.isDemo
                  ? "Demo Concept"
                  : activeVersion?.badge ?? "Live Concept"}
              </span>
              <button
                type="button"
                onClick={onResetDemo}
                title="Reset to demo concepts"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <i className="bi bi-arrow-clockwise text-sm" />
              </button>
            </div>
          </div>

          {/* Preview Image Container / Compare Slider */}
          {showCompare ? (
            <CompareImage
              inputImage={originalImageUrl}
              outputImage={generatedImageUrl}
              inputLabel="Original image"
              outputLabel="Generated image"
            />
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100">
              <div className="aspect-[16/10] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeVersion?.imageUrl || DEMO_HOUSE_SVG}
                  alt={activeVersion?.title || "Design preview"}
                  onError={(e) => {
                    e.currentTarget.src = DEMO_HOUSE_SVG;
                  }}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Top-left overlay badge */}
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-xs">
                <i className="bi bi-stars text-indigo-600" />
                Luna AI Generated
              </div>

              {/* Top-right expand button */}
              <button
                type="button"
                onClick={onOpenLightbox}
                title="Expand preview"
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm backdrop-blur-xs transition hover:bg-white"
              >
                <i className="bi bi-arrows-angle-expand text-xs" />
              </button>

              {/* Bottom-left watermark / status pill */}
              <div className="absolute bottom-3 left-3 rounded-md bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-white uppercase backdrop-blur-xs">
                {activeVersion?.isDemo
                  ? "Illustrative Luna Sample · Not Live AI"
                  : activeVersion?.taskId
                    ? `Live API · Task ${activeVersion.taskId}`
                    : `Live API · ${endpoint}`}
              </div>

              {/* Generating / Polling Overlay */}
              {(activeVersion?.status === "generating" ||
                activeVersion?.status === "polling") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/45 text-white backdrop-blur-[2px]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
                    <i className="bi bi-arrow-repeat animate-spin text-xl" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">
                    {activeVersion.status === "generating"
                      ? "Submitting design brief..."
                      : "Generating design render..."}
                  </p>
                  {activeVersion.taskId && (
                    <p className="mt-1 font-mono text-xs text-slate-200">
                      task_id: {activeVersion.taskId}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Text Answer or Error Banner if API returned non-image */}
          {activeVersion?.textAnswer && (
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs leading-relaxed text-indigo-950">
              <p className="mb-1 font-semibold uppercase tracking-wider text-indigo-700">
                API Text Answer
              </p>
              <p className="whitespace-pre-wrap">{activeVersion.textAnswer}</p>
            </div>
          )}

          {activeVersion?.error && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <span className="font-semibold">API Error:</span> {activeVersion.error}
            </div>
          )}

          {/* Preview Caption */}
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {activeVersion?.title ?? "Illustrative Luna concept"}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {activeVersion?.subtitle ??
                  "Sample preview for testing the builder workflow."}
              </p>
            </div>
            <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {activeVersion?.badge ?? "Demo concept"}
            </span>
          </div>

          {/* Detected Pallets Image Strip */}
          {palletsWithImages.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Design Pallets ({palletsWithImages.length})
                </p>
                <span className="text-[11px] text-slate-400">
                  Click any swatch to inspect
                </span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {palletsWithImages.map((pallet) => (
                  <button
                    key={pallet.id}
                    type="button"
                    onClick={() => setSelectedPallet(pallet)}
                    title={`${pallet.name}${pallet.category ? ` (${pallet.category})` : ""}`}
                    className="group relative flex w-20 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-2xs transition hover:border-indigo-400 hover:shadow-xs"
                  >
                    <div className="relative h-16 w-full overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pallet.image}
                        alt={pallet.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                      {pallet.color_hex && (
                        <span
                          className="absolute right-1 bottom-1 h-3 w-3 rounded-full border border-white shadow-xs"
                          style={{ backgroundColor: pallet.color_hex }}
                        />
                      )}
                    </div>
                    <div className="px-1.5 py-1">
                      <p className="truncate text-[10px] font-medium text-slate-700">
                        {pallet.name}
                      </p>
                      <p className="truncate text-[9px] capitalize text-slate-400">
                        {pallet.category}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview Footer */}
          <div className="mt-auto pt-4">
            <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <i className="bi bi-check2 text-emerald-600" />
              <span>
                Image ready to review. Save it as a design version when approved.
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && activeVersion && (
        <div
          onClick={onCloseLightbox}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={onCloseLightbox}
              className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md hover:bg-white"
            >
              <i className="bi bi-x-lg text-sm" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeVersion.imageUrl || DEMO_HOUSE_SVG}
              alt={activeVersion.title}
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
      {/* Pallet Detail Lightbox Modal */}
      {selectedPallet && selectedPallet.image && (
        <div
          onClick={() => setSelectedPallet(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelectedPallet(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md hover:bg-white"
            >
              <i className="bi bi-x-lg text-xs" />
            </button>
            <div className="bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPallet.image}
                alt={selectedPallet.name}
                className="max-h-[55vh] w-full object-contain"
              />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900">{selectedPallet.name}</h4>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                  {selectedPallet.category}
                </span>
              </div>
              {selectedPallet.details && (
                <p className="mt-1.5 text-xs text-slate-600">{selectedPallet.details}</p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {selectedPallet.color_hex && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-0.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: selectedPallet.color_hex }}
                    />
                    {selectedPallet.color_name ?? selectedPallet.color ?? selectedPallet.color_hex}
                  </span>
                )}
                {selectedPallet.status && (
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium capitalize text-indigo-700">
                    {selectedPallet.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
