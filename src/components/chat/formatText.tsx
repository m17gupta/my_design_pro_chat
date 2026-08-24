import { Fragment, type ReactNode } from "react";

/** Strips unclosed or unescaped broken HTML tags (e.g. `?</` at end of string). */
function sanitizeText(text: string): string {
  if (!text) return "";
  // Strip trailing unclosed opening/closing tags like `</` or `<div` without `>`
  let cleaned = text.replace(/<\/?[a-z0-9_-]*$/gi, "");
  // Strip incomplete tags anywhere that don't close properly
  cleaned = cleaned.replace(/<[a-z0-9_-]+\s*$/gi, "");
  return cleaned;
}

/** Renders markdown bold inline segments or full HTML strings with tags. */
export function renderInline(text: string): ReactNode {
  if (!text) return null;
  const clean = sanitizeText(text);
  if (!clean) return null;

  if (/<[a-z][\s\S]*>/i.test(clean)) {
    return <span dangerouslySetInnerHTML={{ __html: clean }} />;
  }

  const parts = clean.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
