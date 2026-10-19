import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import RevisionDesign, { deriveRevisionRound } from "./RevisionDesign";
import { buildRestoredTranscript, EPISODES } from "../chat/flow";
import type { EnterpriseEntry } from "../../store/enterprise/enterpriseType";

const original: EnterpriseEntry = { id: "original-task", type: "original", status: "completed", url: "https://example.com/original.jpg", questions: [] };
const text: EnterpriseEntry = { id: "text-answer-1", type: "text_answer", answer: "Please ask a project-related question. <script>unsafe</script>", status: "completed", url: "", questions: [{ name: "Revision Comments", type: "textarea", details: "", answer: { notes: "My question" } }] };
function render(role: string, entries: EnterpriseEntry[], round = 1, locked = false) {
  const store = configureStore({ reducer: () => ({ enterprise: { entries }, chat: { role, image_url: original.url } }) });
  return renderToString(<Provider store={store}><RevisionDesign
    messageId={round === 1 ? "ep-revision-summary" : `ep-revision-summary-${round}`}
    entries={entries} fallbackNotes="" fallbackFiles={[]} isCurrent={!locked} rating={0}
    submittedAction={null} pendingGenerate={false} regenerateDisabled={false}
    onRate={vi.fn()} onAllINeed={vi.fn()} onRegenerate={vi.fn()} onEngageDesigner={vi.fn()}
  /></Provider>);
}

describe("revision text-answer rendering", () => {
  it.each(["enterprise", "enterprise-client"])("shows a safe answer and all three available actions for %s", (role) => {
    const html = render(role, [original, text]);
    expect(html).toContain("Please ask a project-related question.");
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).toContain("This Is All I Need For Now");
    expect(html).toContain("Regenerate With Comments");
    expect(html).toContain("Engage Designer");
    expect(html).not.toContain("disabled=");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Download revised design image");
    expect(html).not.toContain("One last pass");
  });
  it("retains the existing enterprise-client image buttons", () => {
    const image: EnterpriseEntry = { ...text, id: "image-task", type: "revision", answer: undefined, url: "https://example.com/revised.jpg" };
    const html = render("enterprise-client", [original, image]);
    expect(html).toContain("revised.jpg");
    expect(html).toContain("Compare");
    expect(html).not.toContain("Engage Designer");
  });
  it("keeps completed text rounds locked when they are no longer current", () => {
    expect(render("enterprise", [original, text], 1, true)).toContain("disabled=");
  });
  it("restores text rounds and binds later image results to their own round", () => {
    const image: EnterpriseEntry = { ...text, id: "image-task", type: "revision", answer: undefined, url: "https://example.com/revised.jpg" };
    const entries = [original, text, image];
    expect(deriveRevisionRound("ep-revision-summary", entries)?.entry).toBe(text);
    expect(deriveRevisionRound("ep-revision-summary-2", entries)?.entry).toBe(image);
    // Completing the last intake question resumes at summary and restores both rounds.
    const lastQuestion = EPISODES.filter((episode) => episode.api).at(-1)!;
    const restored = buildRestoredTranscript({ [lastQuestion.apiKey]: { name: "Last", question: "Last", answer: "Answered" } }, entries, EPISODES);
    expect(restored.messages.map((message) => message.id)).toContain("ep-revision-summary-2");
    expect(render("enterprise", entries, 2)).toContain("Compare revision with original design");
  });
});
