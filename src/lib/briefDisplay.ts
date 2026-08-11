import type { ApiBriefItem } from "./apiBrief";

/** True when an item's answer holds no user input (empty string/array/notes). */
export function isAnswerEmpty(answer: ApiBriefItem["answer"] | undefined): boolean {
  if (answer === undefined) return true;
  if (typeof answer === "string") return answer.trim().length === 0;
  if (Array.isArray(answer)) return answer.length === 0;
  return (
    ("files" in answer ? answer.files.length === 0 : true) &&
    ("value" in answer ? answer.value.length === 0 : true) &&
    answer.notes.trim().length === 0
  );
}

/** Human-readable answer text for Handoff / summary display. */
export function answerToText(item: ApiBriefItem): string {
  const a = item.answer;
  if (typeof a === "string") return a.trim() || "No answer";
  if (Array.isArray(a)) {
    return a.length === 0
      ? "No files uploaded"
      : `${a.length} file${a.length > 1 ? "s" : ""} uploaded`;
  }
  const parts: string[] = [];
  if ("value" in a && a.value.length > 0) parts.push(a.value.join(", "));
  if ("files" in a && a.files.length > 0) {
    parts.push(`${a.files.length} file${a.files.length > 1 ? "s" : ""} uploaded`);
  }
  const notes = a.notes.trim();
  if (notes) parts.push(notes);
  return parts.join(" · ") || "No answer";
}

/** Extract the file URL list from an item's answer (urls or files-notes shapes). */
export function itemUrls(item: ApiBriefItem): string[] {
  const a = item.answer;
  if (Array.isArray(a)) return a;
  if (a && typeof a === "object" && "files" in a) return a.files;
  return [];
}

/** Last path segment of a URL, for file-list display. */
export function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0];
    const seg = clean.split("/");
    return decodeURIComponent(seg[seg.length - 1] || url);
  } catch {
    return url;
  }
}
