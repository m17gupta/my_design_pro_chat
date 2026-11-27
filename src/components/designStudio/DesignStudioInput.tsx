"use client";

import React, { useRef } from "react";
import { DESIGN_DIRECTIONS, IMAGE_STYLES, type ApiEndpoint } from "./types";

interface DesignStudioInputProps {
  showFullRequest: boolean;
  onToggleFullRequest: () => void;
  endpoint: ApiEndpoint;
  onEndpointChange: (endpoint: ApiEndpoint) => void;
  projectId: string;
  onProjectIdChange: (value: string) => void;
  workType: string;
  onWorkTypeChange: (value: string) => void;
  userType: string;
  onUserTypeChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  referenceImageUrl: string;
  onReferenceImageUrlChange: (value: string) => void;
  watermarkUrl: string;
  onWatermarkUrlChange: (value: string) => void;
  activeTab: "generate" | "upload";
  onTabChange: (tab: "generate" | "upload") => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  designDirection: string;
  onDesignDirectionChange: (value: string) => void;
  imageStyle: string;
  onImageStyleChange: (value: string) => void;
  preserveArchitecture: boolean;
  onPreserveArchitectureChange: (checked: boolean) => void;
  numGenerations: number;
  onNumGenerationsChange: (count: number) => void;
  isGenerating: boolean;
  isUploading: boolean;
  onGenerate: () => void;
  onFileUpload: (file: File) => void;
}

/** Left column input panel: Client Brief / API config and Luna AI Studio prompt form. */
export function DesignStudioInput({
  showFullRequest,
  onToggleFullRequest,
  endpoint,
  onEndpointChange,
  projectId,
  onProjectIdChange,
  workType,
  onWorkTypeChange,
  userType,
  onUserTypeChange,
  role,
  onRoleChange,
  referenceImageUrl,
  onReferenceImageUrlChange,
  watermarkUrl,
  onWatermarkUrlChange,
  activeTab,
  onTabChange,
  prompt,
  onPromptChange,
  designDirection,
  onDesignDirectionChange,
  imageStyle,
  onImageStyleChange,
  preserveArchitecture,
  onPreserveArchitectureChange,
  numGenerations,
  onNumGenerationsChange,
  isGenerating,
  isUploading,
  onGenerate,
  onFileUpload,
}: DesignStudioInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-col gap-4 lg:col-span-5">
      {/* Client Brief Card */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Client Brief
            </p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">
              Homeowner request
            </h2>
          </div>
          <button
            type="button"
            onClick={onToggleFullRequest}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800"
          >
            {showFullRequest ? "Hide full request" : "View full request"}
            <i
              className={`bi ${
                showFullRequest ? "bi-chevron-up" : "bi-chevron-down"
              } text-[11px]`}
            />
          </button>
        </div>

        <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
          Refresh the front landscape while preserving the home&apos;s architecture,
          porch, windows, and yellow door.
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <i className="bi bi-image text-slate-400" />1 reference photo
          </span>
          <span>Front view</span>
          <span>Brooke Edwards</span>
        </div>

        {/* Expandable API Test Configuration */}
        {showFullRequest && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
              API Test Configuration
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  API Endpoint
                </label>
                <select
                  value={endpoint}
                  onChange={(e) => onEndpointChange(e.target.value as ApiEndpoint)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="/api/enterprise-design-test">
                    /api/enterprise-design-test (exterior)
                  </option>
                  <option value="/api/design-brief">
                    /api/design-brief (enterprise)
                  </option>
                  <option value="/api/design-brief?mode=revision">
                    /api/design-brief?mode=revision
                  </option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Project ID
                </label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => onProjectIdChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  work_type
                </label>
                <select
                  value={workType}
                  onChange={(e) => onWorkTypeChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="front_yard">front_yard</option>
                  <option value="rear_yard">rear_yard</option>
                  <option value="whole_property">whole_property</option>
                  <option value="color_material">color_material</option>
                  <option value="architectural_addition">architectural_addition</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  user_type / role
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="user_type"
                    value={userType}
                    onChange={(e) => onUserTypeChange(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="role (null)"
                    value={role}
                    onChange={(e) => onRoleChange(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Reference image_url
              </label>
              <input
                type="url"
                value={referenceImageUrl}
                onChange={(e) => onReferenceImageUrlChange(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Watermark URL
              </label>
              <input
                type="url"
                value={watermarkUrl}
                onChange={(e) => onWatermarkUrlChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </section>

      {/* Luna AI Studio Assistant Card */}
      <section className="flex-1 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <i className="bi bi-stars text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Your Design Assistant
              </p>
              <h2 className="text-base font-bold text-slate-900">Luna AI Studio</h2>
            </div>
          </div>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
            AI FIRST
          </span>
        </div>

        {/* Segmented Tabs */}
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onTabChange("generate")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              activeTab === "generate"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="bi bi-stars text-indigo-600" />
            Generate with Luna
          </button>
          <button
            type="button"
            onClick={() => onTabChange("upload")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              activeTab === "upload"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="bi bi-upload" />
            Upload JPG / PNG
          </button>
        </div>

        {activeTab === "upload" ? (
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileUpload(file);
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/30"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <i
                  className={`bi ${
                    isUploading ? "bi-arrow-repeat animate-spin" : "bi-cloud-arrow-up"
                  } text-xl`}
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {isUploading ? "Uploading to S3..." : "Click to upload JPG or PNG"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Uploads via <code className="font-mono">/api/upload</code> and adds to
                Design versions &amp; reference URL.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="reference-image-url"
                className="mb-1.5 block text-xs font-semibold text-slate-800"
              >
                Reference image URL
              </label>
              <div className="flex items-center gap-2">
                {referenceImageUrl.trim() && (
                  <div className="h-9 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={referenceImageUrl.trim()}
                      alt="Reference preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <input
                  id="reference-image-url"
                  type="url"
                  value={referenceImageUrl}
                  onChange={(e) => onReferenceImageUrlChange(e.target.value)}
                  placeholder="https://example.com/property-photo.jpg"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none"
                />
                {referenceImageUrl && (
                  <button
                    type="button"
                    onClick={() => onReferenceImageUrlChange("")}
                    title="Clear image URL"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    <i className="bi bi-x-lg text-xs" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="luna-prompt"
                className="mb-1.5 block text-xs font-semibold text-slate-800"
              >
                What should Luna design?
              </label>
              <textarea
                id="luna-prompt"
                rows={5}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="design-direction"
                  className="mb-1.5 block text-xs font-semibold text-slate-800"
                >
                  Design direction
                </label>
                <select
                  id="design-direction"
                  value={designDirection}
                  onChange={(e) => onDesignDirectionChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                >
                  {DESIGN_DIRECTIONS.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="image-style"
                  className="mb-1.5 block text-xs font-semibold text-slate-800"
                >
                  Image style
                </label>
                <select
                  id="image-style"
                  value={imageStyle}
                  onChange={(e) => onImageStyleChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                >
                  {IMAGE_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={preserveArchitecture}
                onChange={(e) => onPreserveArchitectureChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-700"
              />
              <span>Preserve architecture, original camera angle, and existing colors</span>
            </label>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-800">
                Number of generations
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((count) => {
                  const isSelected = numGenerations === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onNumGenerationsChange(count)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                        isSelected
                          ? "border-[#3b32a8] bg-[#3b32a8] text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={onGenerate}
              className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-[#3730a3] to-[#4338ca] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-[#312e81] hover:to-[#3730a3] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="flex items-center gap-2">
                <i
                  className={`bi ${
                    isGenerating ? "bi-arrow-repeat animate-spin" : "bi-stars"
                  }`}
                />
                {isGenerating
                  ? "Generating Design with Luna..."
                  : "Generate Design with Luna"}
              </span>
              <i className="bi bi-arrow-right" />
            </button>

            <p className="text-[11px] leading-normal text-slate-400">
              Connected to <code className="font-mono text-slate-500">{endpoint}</code>.
              Click <span className="font-medium text-slate-500">View full request</span>{" "}
              above to adjust payload fields or{" "}
              <span className="font-medium text-slate-500">API Inspector</span> to view raw
              JSON.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
