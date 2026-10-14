"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

import { PRESETS, DEFAULT_TEST_PAYLOAD, scenarioPayload, classificationOf, shouldPoll,
  responseText, apiError, assessResponse, type ScopeType, type Preset } from "@/lib/revisionTestScenarios";

const DEFAULT_ORIGINAL_JSON = JSON.stringify(DEFAULT_TEST_PAYLOAD.original, null, 2);

const SCOPES: { value: ScopeType; label: string }[] = [
  { value: "front_yard", label: "Front Yard" },
  { value: "rear_yard", label: "Rear Yard" },
  { value: "whole_property", label: "Whole Property" },
  { value: "color_material", label: "Color & Material" },
  { value: "architectural_addition", label: "Architectural Addition" },
];

interface PollingStatus {
  active: boolean;
  paused: boolean;
  pollCount: number;
  taskId: string | null;
  status: "idle" | "polling" | "completed" | "failed" | "stopped";
  imageUrl: string | null;
  error: string | null;
}

export default function EnterpriseDesignTestPage() {
  const [projectId, setProjectId] = useState("138719");
  const [role, setRole] = useState("");
  const [userType, setUserType] = useState("");
  const [watermark, setWatermark] = useState("https://mydesigns.pro/img/luna-logo.png");
  const [scope, setScope] = useState<ScopeType>("rear_yard");
  const [currentDesignUrl, setCurrentDesignUrl] = useState(
    DEFAULT_TEST_PAYLOAD.image_url
  );
  const [originalJson, setOriginalJson] = useState(DEFAULT_ORIGINAL_JSON);
  const [originalError, setOriginalError] = useState<string | null>(null);
  const [notes, setNotes] = useState(
    DEFAULT_TEST_PAYLOAD.revision_comment.notes
  );
  const [referenceFiles, setReferenceFiles] = useState("");
  const [usePluralKey, setUsePluralKey] = useState(false);

  // Advanced JSON Mode
  const [advancedMode, setAdvancedMode] = useState(false);
  const [jsonPayload, setJsonPayload] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [rawResponse, setRawResponse] = useState<Record<string, unknown> | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Polling state
  const [polling, setPolling] = useState<PollingStatus>({
    active: false,
    paused: false,
    pollCount: 0,
    taskId: null,
    status: "idle",
    imageUrl: null,
    error: null,
  });

  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [submittedPreset, setSubmittedPreset] = useState<Preset | null>(null);
  const presetSnapshot = useRef<string | null>(null);
  const pollEpoch = useRef(0);
  const pollAbort = useRef<AbortController | null>(null);
  const [statusResponse, setStatusResponse] = useState<Record<string, unknown> | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxPolls = 60; // 60 * 3s = 3 minutes max

  // Assemble default payload object
  const buildPayloadFromForm = useCallback(() => {
    let parsedOriginal: unknown = {};
    if (originalJson.trim()) {
      try {
        parsedOriginal = JSON.parse(originalJson);
      } catch {
        parsedOriginal = originalJson;
      }
    }

    const filesArray = referenceFiles
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const revisionObj = {
      files: filesArray,
      notes: notes.trim(),
    };

    const basePayload: Record<string, unknown> = {
      projectId: projectId.trim(),
      role: role.trim() || null,
      user_type: userType.trim(),
      dc_name: "",
      watermark: watermark.trim(),
      work_type: scope,
      image_url: currentDesignUrl.trim(),
      original: parsedOriginal,
    };

    if (usePluralKey) {
      basePayload.revision_comments = revisionObj;
    } else {
      basePayload.revision_comment = revisionObj;
    }

    return basePayload;
  }, [
    projectId,
    role,
    userType,
    watermark,
    scope,
    currentDesignUrl,
    originalJson,
    referenceFiles,
    notes,
    usePluralKey,
  ]);

  // Sync form to JSON when entering advanced mode
  const handleToggleAdvanced = () => {
    if (!advancedMode) {
      const payload = buildPayloadFromForm();
      setJsonPayload(JSON.stringify(payload, null, 2));
      setJsonError(null);
    }
    setAdvancedMode(!advancedMode);
  };

  const applyPreset = (preset: Preset) => {
    stopPolling();
    const payload = scenarioPayload(preset, buildPayloadFromForm());
    setSelectedPreset(preset);
    presetSnapshot.current = JSON.stringify(payload);
    setScope(preset.scope);
    setNotes(preset.notes);
    setReferenceFiles("");
    setAdvancedMode(true);
    setJsonPayload(JSON.stringify(payload, null, 2));
    setJsonError(null);
    setOriginalError(null);
    setRawResponse(null);
    setHttpStatus(null);
    setSubmissionError(null);
    setStatusResponse(null);
    setSubmittedPreset(null);
    setPolling({ active: false, paused: false, pollCount: 0, taskId: null, status: "idle", imageUrl: null, error: null });
  };

  // Stop polling helper
  const stopPolling = useCallback(() => {
    pollEpoch.current += 1;
    pollAbort.current?.abort();
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling((prev) => ({
      ...prev,
      active: false,
      paused: true,
      status: prev.status === "completed" ? "completed" : "stopped",
    }));
  }, []);

  // Poll single iteration
  const pollTaskStatus = useCallback(
    async function pollNext(taskId: string, currentCount: number, epoch: number) {
      if (epoch !== pollEpoch.current) return;
      if (currentCount >= maxPolls) {
        setPolling((prev) => ({
          ...prev,
          active: false,
          paused: true,
          status: "stopped",
          error: "Polling budget reached (3 minutes). Click Resume to continue.",
        }));
        return;
      }

      try {
        const abort = new AbortController();
        pollAbort.current = abort;
        const res = await fetch(
          `/api/enterprise-design-test/status?task_id=${encodeURIComponent(taskId)}`,
          {
            cache: "no-store", signal: abort.signal,
          }
        );
        const data = await res.json();
        if (epoch !== pollEpoch.current) return;
        setStatusResponse(data);

        if (res.ok) {
          const status = String(data.status || data.state).toLowerCase();
          const generatedUrl =
            data.result?.generated_image_url ||
            data.result?.s3_url ||
            data.generated_image_url ||
            data.result?.url ||
            null;

          if (status === "completed") {
            setPolling({
              active: false,
              paused: false,
              pollCount: currentCount + 1,
              taskId,
              status: "completed",
              imageUrl: generatedUrl,
              error: null,
            });
            return;
          }

          if (["failed", "error", "cancelled", "submission_unknown"].includes(status)) {
            setPolling({
              active: false,
              paused: false,
              pollCount: currentCount + 1,
              taskId,
              status: "failed",
              imageUrl: null,
              error: data.error || `Backend task status: ${status}. Reconcile before resubmitting.`,
            });
            return;
          }

          // In progress: continue polling in 3s
          setPolling((prev) => ({
            ...prev,
            pollCount: currentCount + 1,
            status: "polling",
          }));

          pollTimerRef.current = setTimeout(() => {
            void pollNext(taskId, currentCount + 1, epoch);
          }, 3000);
        } else {
          setPolling((prev) => ({ ...prev, active: false, paused: true, status: "stopped",
            error: `Status HTTP ${res.status}: ${apiError(data)}` }));
        }
      } catch (err) {
        if (epoch !== pollEpoch.current) return;
        const msg = err instanceof Error ? err.message : "Polling network error";
        setPolling((prev) => ({ ...prev, active: false, paused: true, status: "stopped", error: msg }));
      }
    },
    [maxPolls]
  );

  // Resume polling
  const resumePolling = () => {
    if (!polling.taskId) return;
    stopPolling();
    setPolling((prev) => ({ ...prev, active: true, paused: false, pollCount: 0, status: "polling", error: null }));
    void pollTaskStatus(polling.taskId, 0, pollEpoch.current);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      pollEpoch.current += 1;
      pollAbort.current?.abort();
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    stopPolling();
    setIsSubmitting(true);
    setHttpStatus(null);
    setRawResponse(null);
    setSubmissionError(null);
    setStatusResponse(null);
    setSubmittedPreset(null);
    setPolling({
      active: false,
      paused: false,
      pollCount: 0,
      taskId: null,
      status: "idle",
      imageUrl: null,
      error: null,
    });

    let payload: unknown;

    if (advancedMode) {
      try {
        payload = JSON.parse(jsonPayload);

      } catch (err) {
        setJsonError(err instanceof Error ? err.message : "Invalid JSON syntax");
        setIsSubmitting(false);
        return;
      }
    } else {
      if (originalJson.trim()) {
        try {
          JSON.parse(originalJson);
        } catch (err) {
          setOriginalError(
            err instanceof Error ? `Invalid JSON in "original": ${err.message}` : "Invalid JSON"
          );
          setIsSubmitting(false);
          return;
        }
      }
      payload = buildPayloadFromForm();
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      setJsonError("Request JSON must be an object."); setIsSubmitting(false); return;
    }
    setSubmittedPreset(presetSnapshot.current === JSON.stringify(payload) ? selectedPreset : null);
    const epoch = pollEpoch.current;
    try {
      const res = await fetch("/api/enterprise-design-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      setHttpStatus(res.status);
      const data = await res.json();
      setRawResponse(data);

      if (!res.ok) {
        setSubmissionError(apiError(data));
        return;
      }
      if (shouldPoll(res.status, data)) {
        const returnedTaskId = String(data.task_id);
        setPolling({ active: true, paused: false, pollCount: 0, taskId: returnedTaskId,
          status: "polling", imageUrl: null, error: null });
        pollTimerRef.current = setTimeout(() => {
          void pollTaskStatus(returnedTaskId, 0, epoch);
        }, 3000);
      } else if (res.status === 202) {
        setSubmissionError("Invalid generation response: expected image_generation and task_id. Check backend records before retrying.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network request failed";
      setSubmissionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Response parsing helpers
  const resultObj =
    rawResponse?.result && typeof rawResponse.result === "object" && !Array.isArray(rawResponse.result)
      ? (rawResponse.result as Record<string, unknown>)
      : null;
  const responseType =
    resultObj?.response_type ||
    rawResponse?.response_type ||
    rawResponse?.type ||
    (rawResponse?.status === "text_answer" ? "text_answer" : null) ||
    (httpStatus === 202 ? "generation" : null);
  const classification = classificationOf(rawResponse);
  const confidence = typeof classification?.image_edit_confidence === "number"
    ? classification.image_edit_confidence : null;
  const unsupportedChanges =
    (Array.isArray(resultObj?.unsupported_changes) && resultObj.unsupported_changes.length
      ? resultObj.unsupported_changes
      : null) ||
    (Array.isArray(rawResponse?.unsupported_changes) && rawResponse.unsupported_changes.length
      ? rawResponse.unsupported_changes
      : null);
  const textAnswer = rawResponse ? responseText(rawResponse) : null;
  const assessment = rawResponse && httpStatus !== null ? assessResponse(httpStatus, rawResponse, submittedPreset) : null;

  // Validate image URL safely before rendering
  const isValidImageUrl = (url: string | null): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Isolated Backend Test
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Same-Origin Proxy
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mt-1">
                Enterprise Design Revision Test UI
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                Target:{" "}
                <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                  POST /api/v1/luna/enterprise-design/test
                </code>{" "}
                via{" "}
                <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                  /api/enterprise-design-test
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleAdvanced}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                {advancedMode ? "Switch to Form Mode" : "Switch to Raw JSON Editor"}
              </button>
            </div>
          </div>
        </header>

        {/* Presets Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2.5">
            Scenario conditions (click to load exact request JSON)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={isSubmitting}
                aria-pressed={selectedPreset?.id === p.id}
                className="flex flex-col text-left p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20 transition group"
              >
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                  {p.name}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                  {p.description}
                </span>
                {p.mayGenerate && <span className="text-[10px] text-amber-700 mt-1">May generate a billed image</span>}
              </button>
            ))}
          </div>
          {selectedPreset && <p className="text-xs mt-3 text-emerald-700 dark:text-emerald-300">Selected: {selectedPreset.name}. {selectedPreset.description}. The raw editor preserves null/empty fields and deliberate validation errors. Editing it switches the result to custom-request review.</p>}
          <p className="text-[11px] text-zinc-500 mt-2">No automatic batch run. Each submission calls the real backend; model decisions and image quality need review.</p>
        </div>

        {/* Main Grid: Form + Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form / Request Editor (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <form
              onSubmit={handleSubmit}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="font-semibold text-sm">
                  {advancedMode
                    ? "Advanced JSON Request Editor"
                    : "Revision Request Parameters"}
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePluralKey}
                    onChange={(e) => setUsePluralKey(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Use plural <code className="text-[11px]">revision_comments</code>
                  </span>
                </label>
              </div>

              {advancedMode ? (
                <div>
                  <textarea
                    rows={18}
                    value={jsonPayload}
                    onChange={(e) => {
                      setJsonPayload(e.target.value);
                      setJsonError(null);
                    }}
                    className="w-full font-mono text-xs p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter full request JSON..."
                  />
                  {jsonError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                      Syntax error: {jsonError}
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Edit raw payload directly. Neither entered data nor responses are persisted in browser storage.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Context row: ProjectId, Scope */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Scope (work_type)
                      </label>
                      <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value as ScopeType)}
                        className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      >
                        {SCOPES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label} ({s.value})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Project ID (projectId)
                      </label>
                      <input
                        type="text"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        placeholder="138719"
                        required
                      />
                    </div>
                  </div>

                  {/* Context row: Role, User Type, Watermark */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        placeholder="enterprise"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        User Type (user_type)
                      </label>
                      <input
                        type="text"
                        value={userType}
                        onChange={(e) => setUserType(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        placeholder="landscape-design"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Watermark
                      </label>
                      <input
                        type="text"
                        value={watermark}
                        onChange={(e) => setWatermark(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-[11px]"
                        placeholder="https://mydesigns.pro/img/luna-logo.png"
                      />
                    </div>
                  </div>

                  {/* Current design URL */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Current Design Image URL (image_url)
                    </label>
                    <input
                      type="url"
                      value={currentDesignUrl}
                      onChange={(e) => setCurrentDesignUrl(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                      placeholder="https://example.com/current-design.png"
                      required
                    />
                  </div>

                  {/* Dedicated Original Key JSON Text Box */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Original Brief / Questionnaires JSON (
                        <code className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          original
                        </code>{" "}
                        key)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const formatted = JSON.stringify(
                              JSON.parse(originalJson),
                              null,
                              2
                            );
                            setOriginalJson(formatted);
                            setOriginalError(null);
                          } catch {
                            setOriginalError("Invalid JSON syntax: cannot format");
                          }
                        }}
                        className="text-[11px] text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 transition"
                      >
                        Format JSON
                      </button>
                    </div>
                    <textarea
                      rows={9}
                      value={originalJson}
                      onChange={(e) => {
                        setOriginalJson(e.target.value);
                        setOriginalError(null);
                      }}
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder='Paste original object JSON here, e.g. { "project_goals_or_brief_description": { ... } }'
                    />
                    {originalError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-mono">
                        {originalError}
                      </p>
                    )}
                  </div>

                  {/* Revision notes */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Revision Notes (notes)
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Describe the requested changes or ask design advice..."
                    />
                  </div>

                  {/* Reference image URLs */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Reference Image URLs (files: one URL per line, optional)
                    </label>
                    <textarea
                      rows={2}
                      value={referenceFiles}
                      onChange={(e) => setReferenceFiles(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="https://example.com/ref1.jpg&#10;https://example.com/ref2.jpg"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs tracking-wide shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Sending to Test Endpoint...</span>
                    </>
                  ) : (
                    <span>Submit to Test Endpoint</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Response Inspector & Polling (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Status Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="font-semibold text-sm">Response & Routing</h3>
                {httpStatus !== null && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      httpStatus >= 200 && httpStatus < 300
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : httpStatus === 422
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    HTTP {httpStatus}
                  </span>
                )}
              </div>

              {submissionError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  <strong>API / connection error:</strong> {submissionError}
                </div>
              )}

              {assessment && <div className={`p-3 rounded-lg border text-xs ${assessment.verdict === "pass" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : assessment.verdict === "fail" ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"}`} role="status">
                <strong>{assessment.verdict === "pass" ? "Checks passed" : assessment.verdict === "fail" ? "Checks failed" : "Needs review"}</strong>
                <ul className="mt-2 list-disc pl-4 space-y-1">{assessment.checks.map((check, i) => <li key={i}>{check}</li>)}</ul>
              </div>}
              {rawResponse ? (
                <div className="space-y-3.5">
                  {/* Response Type & Confidence */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-500 block">Response Type</span>
                      <span className="font-semibold capitalize text-zinc-800 dark:text-zinc-200">
                        {String(responseType || "unknown")}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-500 block">Confidence</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {confidence !== null
                          ? `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}%`
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Confidence Bar with 70% threshold */}
                  {confidence !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>Model Routing Score</span>
                        <span>Threshold: 70%</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, confidence <= 1 ? confidence * 100 : confidence)
                            )}%`,
                          }}
                        />
                        {/* 70% marker line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-zinc-900 dark:bg-zinc-100 z-10"
                          style={{ left: "70%" }}
                          title="70% Threshold"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Confidence is a model routing score, not a calibrated probability.
                      </p>
                    </div>
                  )}

                  {/* Unsupported changes alert */}
                  {Boolean(unsupportedChanges) && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
                      <span className="font-semibold block mb-0.5">Unsupported Changes:</span>
                      <p className="whitespace-pre-wrap">
                        {typeof unsupportedChanges === "string"
                          ? unsupportedChanges
                          : JSON.stringify(unsupportedChanges, null, 2)}
                      </p>
                    </div>
                  )}

                  {/* Plain Text Answer / Clarification (explicitly not rendered as HTML) */}
                  {textAnswer && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Answer / Clarification Text:
                      </label>
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs whitespace-pre-wrap font-sans text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        {textAnswer}
                      </div>
                    </div>
                  )}
                </div>
              ) : !submissionError ? (
                <div className="text-center py-8 text-xs text-zinc-400">
                  Submit a request or select a preset to view the backend routing response.
                </div>
              ) : null}
            </div>

            {/* Polling / Generation Panel (shown when task_id is present) */}
            {polling.taskId && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                  <h3 className="font-semibold text-sm">Image Generation Poller</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      polling.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : polling.status === "failed"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : polling.active
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse"
                        : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {polling.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Task ID:</span>
                    <code className="font-mono text-zinc-800 dark:text-zinc-200">
                      {polling.taskId}
                    </code>
                  </div>
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Poll count:</span>
                    <span>
                      {polling.pollCount} / {maxPolls}
                    </span>
                  </div>
                </div>

                {polling.error && (
                  <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs">
                    {polling.error}
                  </div>
                )}

                {/* Polling controls */}
                <div className="flex gap-2 pt-1">
                  {polling.active && (
                    <button
                      type="button"
                      onClick={stopPolling}
                      className="flex-1 py-1.5 px-3 text-xs rounded border border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                    >
                      Stop Polling
                    </button>
                  )}
                  {polling.paused && polling.status !== "completed" && (
                    <button
                      type="button"
                      onClick={resumePolling}
                      className="flex-1 py-1.5 px-3 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      Resume Polling
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Stopping polling cancels browser requests only; it does not cancel server-side generation.
                </p>

                {/* Generated Image Preview */}
                {polling.imageUrl && isValidImageUrl(polling.imageUrl) && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Generated Result Image:
                    </span>
                    <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-[16/10] bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={polling.imageUrl}
                        alt="Generated revision design"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <a
                      href={polling.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline break-all block"
                    >
                      Open full image ↗
                    </a>
                  </div>
                )}
              </div>
            )}

            {statusResponse && <details className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"><summary className="text-xs font-semibold cursor-pointer">Latest task status response</summary><pre className="text-[11px] mt-3 overflow-auto max-h-80 whitespace-pre-wrap">{JSON.stringify(statusResponse, null, 2)}</pre></details>}
            {/* Collapsible Raw JSON Response Inspector */}
            {rawResponse && (
              <details className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm group">
                <summary className="font-semibold text-xs cursor-pointer select-none text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 flex items-center justify-between">
                  <span>Raw Backend JSON Response</span>
                  <span className="text-[10px] text-zinc-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="mt-3 relative">
                  <pre className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono overflow-auto max-h-80 text-zinc-800 dark:text-zinc-200">
                    {JSON.stringify(rawResponse, null, 2)}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(JSON.stringify(rawResponse, null, 2))
                    }
                    className="absolute top-2 right-2 px-2 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded text-[10px] font-sans"
                  >
                    Copy
                  </button>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
