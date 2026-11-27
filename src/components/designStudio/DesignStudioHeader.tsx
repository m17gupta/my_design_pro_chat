"use client";

import React from "react";
import type { ApiEndpoint } from "./types";

interface DesignStudioHeaderProps {
  endpoint: ApiEndpoint;
  showInspector: boolean;
  onToggleInspector: () => void;
  lastHttpStatus: number | null;
  requestPayload: unknown;
  lastApiResponse: unknown;
}

/** Top header bar with status badge and collapsible API request/response inspector. */
export function DesignStudioHeader({
  endpoint,
  showInspector,
  onToggleInspector,
  lastHttpStatus,
  requestPayload,
  lastApiResponse,
}: DesignStudioHeaderProps) {
  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Design Studio / Front Exterior
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Review &amp; send designs
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleInspector}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-xs transition hover:border-indigo-300 hover:text-indigo-700"
          >
            <i className="bi bi-terminal text-xs" />
            {showInspector ? "Hide API Inspector" : "API Inspector"}
            {lastHttpStatus !== null && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  lastHttpStatus >= 200 && lastHttpStatus < 300
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {lastHttpStatus}
              </span>
            )}
          </button>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Work order ready
          </span>
        </div>
      </header>

      {showInspector && (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                API Request &amp; Response Inspector
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                POST {endpoint}
              </span>
            </div>
            {lastHttpStatus !== null && (
              <span className="text-xs font-semibold text-slate-600">
                Last HTTP Status: <span className="font-mono">{lastHttpStatus}</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                Request Payload
              </p>
              <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
                {JSON.stringify(requestPayload, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                Last API Response
              </p>
              <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-emerald-300">
                {lastApiResponse
                  ? JSON.stringify(lastApiResponse, null, 2)
                  : "// Click 'Generate Design with Luna' to inspect live API response"}
              </pre>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
