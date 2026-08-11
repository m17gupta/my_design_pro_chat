"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { API_QUESTIONS } from "./flow";
import type { ApiBriefPayload } from "../../lib/apiBrief";
import {
  answerToText,
  fileNameFromUrl,
  isAnswerEmpty,
  itemUrls,
} from "../../lib/briefDisplay";
import { CHECKLIST } from "./types";

interface HandoffPanelProps {
  /** checklistId → answer text (live session). */
  answers: Record<string, string>;
  /** episodeId → (field index → uploaded files). */
  uploads: Record<string, Record<number, File[]>>;
  /** episodeId → (field index → fileKey → Cloudinary URL). */
  fileUrls: Record<string, Record<number, Record<string, string>>>;
  /** Full brief payload from the Redux store — restores answers/files after refresh. */
  payload?: ApiBriefPayload;
  onBackToChat: () => void;
}

const UPLOAD_LABELS: Record<string, string> = {
  photos: "House photos",
  files: "Supporting files",
  styles: "Style reference images",
  hardscape: "Hardscape reference images",
  softscape: "Softscape reference images",
};

export default function HandoffPanel({
  answers,
  uploads,
  fileUrls,
  payload,
  onBackToChat,
}: HandoffPanelProps) {
  // Answers restored from the Redux store (visible after refresh), keyed by
  // checklistId via each question's metadata.
  const storeText = useMemo(() => {
    const map: Record<string, string> = {};
    if (!payload) return map;
    API_QUESTIONS.forEach((q) => {
      const item = payload.original[q.apiKey];
      if (item && q.checklistId && !isAnswerEmpty(item.answer)) {
        map[q.checklistId] = answerToText(item);
      }
    });
    return map;
  }, [payload]);

  const answeredCount = CHECKLIST.filter((c) => answers[c.id] || storeText[c.id]).length;

  const uploadedFiles = Object.entries(uploads)
    .map(([episodeId, fields]) => ({
      episodeId,
      files: Object.values(fields).flat(),
    }))
    .filter(({ files }) => files.length > 0);

  // fileKey (`name-size`) → Cloudinary URL, flattened across all episodes.
  const urlByKey = new Map<string, string>();
  Object.values(fileUrls).forEach((fields) =>
    Object.values(fields).forEach((map) =>
      Object.entries(map).forEach(([key, url]) => urlByKey.set(key, url))
    )
  );

  // File URLs restored from the store, minus any already shown from the live
  // session (so nothing is listed twice).
  const localUrls = useMemo(() => {
    const set = new Set<string>();
    Object.values(fileUrls).forEach((fields) =>
      Object.values(fields).forEach((map) =>
        Object.values(map).forEach((u) => set.add(u))
      )
    );
    return set;
  }, [fileUrls]);

  const restoredFiles = useMemo(() => {
    if (!payload) return [];
    return API_QUESTIONS.flatMap((q) => {
      const item = payload.original[q.apiKey];
      if (!item) return [];
      const urls = itemUrls(item).filter((u) => !localUrls.has(u));
      if (urls.length === 0) return [];
      // Match the live-session group label when one exists (e.g. "House photos").
      const label = q.checklistId ? UPLOAD_LABELS[q.checklistId] : undefined;
      return [{ key: q.apiKey, name: label ?? item.name, urls }];
    });
  }, [payload, localUrls]);

  const hasFiles = uploadedFiles.length > 0 || restoredFiles.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Design Coordinator
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Brooke Edwards
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            This brief is built automatically from your conversation with Luna.
          </p>
        </div>
        <motion.button
          type="button"
          onClick={onBackToChat}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          ← Back to chat
        </motion.button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Answers */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Project answers
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {answeredCount}/{CHECKLIST.length}
            </span>
          </h3>
          <ul className="space-y-2.5">
            {CHECKLIST.map((item) => {
              const answer = answers[item.id] || storeText[item.id];
              return (
                <li key={item.id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      answer
                        ? "bg-emerald-500 text-white"
                        : "border border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                    }`}
                  >
                    {item.number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                      {item.label}
                    </p>
                    <p
                      className={`mt-0.5 text-[13px] ${
                        answer
                          ? "text-zinc-500 dark:text-zinc-400"
                          : "italic text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {answer || "Not answered yet"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-4">
          {/* Uploaded files */}
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Uploaded files
            </h3>
            {!hasFiles ? (
              <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                No files uploaded yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {uploadedFiles.map(({ episodeId, files }) => (
                  <li key={episodeId}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {UPLOAD_LABELS[episodeId] ?? "Files"}
                    </p>
                    <ul className="space-y-1">
                      {files.map((f) => (
                        <li
                          key={`${f.name}-${f.size}`}
                          className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="shrink-0 text-emerald-500"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          <span className="truncate">{f.name}</span>
                          {urlByKey.get(`${f.name}-${f.size}`) && (
                            <a
                              href={urlByKey.get(`${f.name}-${f.size}`)}
                              target="_blank"
                              rel="noreferrer"
                              title={urlByKey.get(`${f.name}-${f.size}`)}
                              aria-label={`Open ${f.name} in a new tab`}
                              className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <path d="M15 3h6v6" />
                                <path d="M10 14L21 3" />
                              </svg>
                              link
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                {restoredFiles.map(({ key, name, urls }) => (
                  <li key={`restored-${key}`}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {name}
                    </p>
                    <ul className="space-y-1">
                      {urls.map((url) => (
                        <li
                          key={url}
                          className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="shrink-0 text-emerald-500"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          <span className="truncate">{fileNameFromUrl(url)}</span>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            title={url}
                            aria-label={`Open ${fileNameFromUrl(url)} in a new tab`}
                            className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <path d="M15 3h6v6" />
                              <path d="M10 14L21 3" />
                            </svg>
                            link
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comments */}
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Comments
            </h3>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 py-8 text-center dark:border-zinc-700">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-zinc-300 dark:text-zinc-600"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                No comments — Brooke will review this brief shortly.
              </p>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
