import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "react-hot-toast";
import { uploadFile, type UploadResult } from "../../lib/upload";
import { useAppSelector } from "../../store/hooks";
import type { UploadSpec } from "./types";

const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".dwg",
  ".rvt",
  ".skp",
  ".pdf",
  ".doc",
  ".docx",
];

const ACCEPT_FORMATS = ALLOWED_EXTENSIONS.join(",") + ",image/*";

function getFileExt(nameOrUrl: string): string {
  if (!nameOrUrl) return "";
  const clean = nameOrUrl.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length <= 1) return "";
  return "." + parts.pop()!.toLowerCase();
}

type FileCategory = "image" | "pdf" | "doc" | "cad" | "other";

function getFileCategory(nameOrUrl: string): FileCategory {
  const ext = getFileExt(nameOrUrl);
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if ([".doc", ".docx"].includes(ext)) return "doc";
  if ([".dwg", ".rvt", ".skp"].includes(ext)) return "cad";
  return "other";
}

interface UploadZoneProps {
  spec: UploadSpec;
  files: File[];
  initialUrls?: string[];
  disabled?: boolean;
  /** Compact grid-box variant used inside question cards. */
  compact?: boolean;
  onChange: (files: File[]) => void;
  /** Called with fileKey → upload result whenever uploaded URLs change. */
  onUrlsChange?: (urls: Record<string, UploadResult>) => void;
  /** Called when any file starts or finishes uploading. */
  onUploadingChange?: (isUploading: boolean) => void;
}

interface UploadStatus {
  state: "uploading" | "done" | "error";
  percent?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadZone({
  spec,
  files,
  initialUrls = [],
  disabled = false,
  compact = false,
  onChange,
  onUrlsChange,
  onUploadingChange,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Record<string, UploadStatus>>({});
  const [urls, setUrls] = useState<Record<string, UploadResult>>({});
  const reduceMotion = useReducedMotion();
  // Group every upload of the same project under luna-ai/<projectId>/ in S3.
  const projectId = useAppSelector((s) => s.chat.id);

  useEffect(() => {
    const isUploading = Object.values(status).some((st) => st.state === "uploading");
    onUploadingChange?.(isUploading);
  }, [status, onUploadingChange]);

  // The url map lives in a ref so async completions always notify the parent
  // with the full accumulated state, not just the latest single upload.
  const urlsRef = useRef<Record<string, UploadResult>>({});
  // Keys removed while an upload is still in flight — their completion is
  // discarded so a removed file can't resurrect into the URL map/brief.
  const removedKeysRef = useRef<Set<string>>(new Set());

  const keyOf = useCallback((file: File) => `${file.name}-${file.size}`, []);

  // Local object URLs for image previews in compact slots, keyed like files and
  // recreated whenever the file list changes. The URLs of a superseded render
  // are revoked by the effect below (also on unmount), so every URL is
  // released exactly once.
  const previewUrls = useMemo(() => {
    const map: Record<string, string> = {};
    files.forEach((file) => {
      map[keyOf(file)] = URL.createObjectURL(file);
    });
    return map;
  }, [files, keyOf]);

  useEffect(() => {
    const urls = Object.values(previewUrls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  const startUpload = useCallback(
    (file: File) => {
      console.log("hjsds")
      const key = keyOf(file);
      setStatus((prev) => ({ ...prev, [key]: { state: "uploading", percent: 0 } }));
      uploadFile(file, (percent) =>
        setStatus((prev) => ({ ...prev, [key]: { state: "uploading", percent } }))
      , projectId)
        .then((result) => {
          if (removedKeysRef.current.has(key)) return;
          setStatus((prev) => ({ ...prev, [key]: { state: "done" } }));
          // Persist the returned S3 URL so the app can use it.
          const nextUrls = { ...urlsRef.current, [key]: result };
          urlsRef.current = nextUrls;
          setUrls(nextUrls);
          onUrlsChange?.(nextUrls);
        })
        .catch(() => {
          if (removedKeysRef.current.has(key)) return;
          setStatus((prev) => ({ ...prev, [key]: { state: "error" } }));
        });
    },
    [keyOf, onUrlsChange, projectId]
  );

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list || disabled) return;
      const incoming = Array.from(list).slice(0, 10);

      const invalidFiles = incoming.filter(
        (f) => !ALLOWED_EXTENSIONS.includes(getFileExt(f.name))
      );
      if (invalidFiles.length > 0) {
        toast.error(
          `Invalid file format. Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`
        );
      }

      const validIncoming = incoming.filter((f) =>
        ALLOWED_EXTENSIONS.includes(getFileExt(f.name))
      );
      if (validIncoming.length === 0) return;

      const seen = new Set(files.map(keyOf));
      const newFiles = validIncoming.filter((f) => !seen.has(keyOf(f)));
      const merged = [...files, ...newFiles].slice(0, 10);
      onChange(merged);
      newFiles.forEach((f) => {
        removedKeysRef.current.delete(keyOf(f));
        startUpload(f);
      });
    },
    [files, onChange, disabled, keyOf, startUpload]
  );

  const removeFile = useCallback(
    (name: string, size: number) => {
      onChange(files.filter((f) => !(f.name === name && f.size === size)));
      setStatus((prev) => {
        const next = { ...prev };
        delete next[`${name}-${size}`];
        return next;
      });
      const key = `${name}-${size}`;
      removedKeysRef.current.add(key);
      if (urlsRef.current[key]) {
        const nextUrls = { ...urlsRef.current };
        delete nextUrls[key];
        urlsRef.current = nextUrls;
        setUrls(nextUrls);
        onUrlsChange?.(nextUrls);
      }
    },
    [files, onChange, onUrlsChange]
  );

  const [removedInitial, setRemovedInitial] = useState(false);

  useEffect(() => {
    setRemovedInitial(false);
  }, [initialUrls]);

  const activeInitialUrls = removedInitial ? [] : initialUrls;

  // A compact slot that already holds files becomes an image-preview box
  // (solid border, no padding) instead of the dashed drop target.
  const filled = compact && (files.length > 0 || activeInitialUrls.length > 0);

  return (
    <div className={compact ? "" : "mt-2.5 w-full max-w-sm"}>
      <motion.div
        initial={reduceMotion || compact ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 380, damping: 28 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role={filled ? undefined : "button"}
        tabIndex={filled || disabled ? -1 : 0}
        aria-label={filled ? undefined : spec.label}
        onKeyDown={
          filled
            ? undefined
            : (e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled) {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }
        }
        className={`rounded-xl border-2 text-center transition-all duration-150 focus-visible:outline-none ${
          filled
            ? "border-solid border-zinc-200 bg-white p-0 dark:border-zinc-700 dark:bg-zinc-900"
            : compact
              ? "border-dashed aspect-square flex flex-col items-center justify-center px-2 py-3"
              : "cursor-pointer rounded-2xl border-dashed px-5 py-6"
        } ${
          !filled &&
          (dragging
            ? "scale-[1.01] border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
            : "border-emerald-200 bg-white/70 hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-zinc-900/60 dark:hover:bg-emerald-500/5")
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        {!filled && (
          <svg
            width={compact ? 18 : 26}
            height={compact ? 18 : 26}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`mx-auto text-emerald-500 transition-transform duration-150 ${
              compact ? "mb-1" : "mb-2"
            } ${dragging ? "-translate-y-1" : ""}`}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8l-5-5-5 5" />
            <path d="M12 3v12" />
          </svg>
        )}
        {compact ? (
          filled ? (
            <div
              className={`grid gap-1.5 ${
                Math.max(files.length, initialUrls.length) >= 2 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {files.length > 0 ? files.map((file, fileIdx) => {
                const st = status[keyOf(file)];
                // Once a file has a persisted S3 URL (from Redux via
                // initialUrls), show that instead of the in-memory blob
                // preview — blob URLs are session-scoped and die on refresh,
                // and edit mode should reflect the canonical stored URL.
                // Files beyond the URL count are still uploading → blob.
                const s3Url = fileIdx < initialUrls.length ? initialUrls[fileIdx] : undefined;
                const fileSource = s3Url ?? previewUrls[keyOf(file)] ?? file.name;
                const category = getFileCategory(file.name || fileSource);

                return (
                  <motion.div
                    key={`${file.name}-${file.size}`}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
                  >
                    {category === "image" ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={s3Url ?? previewUrls[keyOf(file)]}
                        alt={file.name}
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : category === "pdf" ? (
                      <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                        <i className="bi bi-file-earmark-pdf text-3xl mb-1" />
                        <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-700 dark:text-zinc-300 px-1">
                          {file.name}
                        </span>
                      </div>
                    ) : category === "doc" ? (
                      <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                        <i className="bi bi-file-earmark-word text-3xl mb-1" />
                        <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-700 dark:text-zinc-300 px-1">
                          {file.name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <i className="bi bi-file text-3xl mb-1" />
                        <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-700 dark:text-zinc-300 px-1">
                          {file.name}
                        </span>
                      </div>
                    )}
                    {st?.state === "uploading" && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45"
                        aria-live="polite"
                      >
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span className="text-[10px] font-semibold text-white">
                          Uploading {st.percent ?? 0}%
                        </span>
                      </div>
                    )}
                    {st?.state === "error" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startUpload(file);
                          }}
                          className="rounded-md bg-red-500 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-red-600"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.name, file.size);
                      }}
                      aria-label={`Remove ${file.name}`}
                      className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-white shadow-md shadow-black/20 transition-all duration-150 hover:scale-110 hover:bg-red-600"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </motion.div>
                );
              }) : activeInitialUrls.map((url, i) => {
                const category = getFileCategory(url);
                const fileName = url.split("/").pop() || `File ${i + 1}`;
                return (
                  <motion.div
                    key={`url-${i}`}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
                  >
                    {category === "image" ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={url}
                        alt={`Uploaded file ${i + 1}`}
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : category === "pdf" ? (
                      <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                        <i className="bi bi-file-earmark-pdf text-3xl mb-1" />
                        <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-700 dark:text-zinc-300 px-1">
                          {fileName}
                        </span>
                      </div>
                    ) : category === "doc" ? (
                      <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                        <i className="bi bi-file-earmark-word text-3xl mb-1" />
                        <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-700 dark:text-zinc-300 px-1">
                          {fileName}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <i className="bi bi-file text-3xl mb-1" />
                        <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-700 dark:text-zinc-300 px-1">
                          {fileName}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemovedInitial(true);
                        onUrlsChange?.({});
                      }}
                      aria-label={`Remove file ${i + 1}`}
                      className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-white shadow-md shadow-black/20 transition-all duration-150 hover:scale-110 hover:bg-red-600"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] font-medium leading-tight text-emerald-900 dark:text-emerald-100">
              <span className="block">Drag &amp; drop files here</span>
              <span className="block text-zinc-400 dark:text-zinc-500">
                (or click to select file)
              </span>
            </p>
          )
        ) : (
          <>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              {spec.label}
            </p>
            {spec.hint && (
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{spec.hint}</p>
            )}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT_FORMATS}
          multiple={spec.multiple}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </motion.div>

      {!compact && files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {files.map((file) => {
            const st = status[keyOf(file)];
            const category = getFileCategory(file.name);
            return (
              <motion.li
                key={`${file.name}-${file.size}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="group flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {category === "pdf" ? (
                  <i className="bi bi-file-earmark-pdf text-base text-red-500 shrink-0" />
                ) : category === "doc" ? (
                  <i className="bi bi-file-earmark-word text-base text-blue-600 shrink-0" />
                ) : category === "cad" ? (
                  <i className="bi bi-file text-base text-zinc-500 shrink-0" />
                ) : (
                  <i className="bi bi-file-earmark-image text-base text-emerald-500 shrink-0" />
                )}
                <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                  {file.name}
                </span>
                <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
                  {formatSize(file.size)}
                </span>
                {st?.state === "uploading" && (
                  <span
                    className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500"
                    aria-live="polite"
                  >
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
                    {st.percent != null ? `${st.percent}%` : "…"}
                  </span>
                )}
                {st?.state === "done" && (
                  <span className="flex shrink-0 items-center gap-0.5 text-emerald-500">
                    {urls[keyOf(file)] && (
                      <a
                        href={urls[keyOf(file)].url}
                        target="_blank"
                        rel="noreferrer"
                        title={urls[keyOf(file)].url}
                        aria-label={`Open uploaded file ${file.name}`}
                        className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                      >
                        <svg
                          width="12"
                          height="12"
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
                      </a>
                    )}
                    <span title="Uploaded">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  </span>
                )}
                {st?.state === "error" && (
                  <button
                    type="button"
                    onClick={() => startUpload(file)}
                    disabled={disabled}
                    className="shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(file.name, file.size)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default memo(UploadZone);
