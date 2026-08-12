import { describe, expect, it } from "vitest";
import type { ApiBriefItem } from "../../lib/apiBrief";
import {
  API_QUESTIONS,
  EPISODES,
  buildMessage,
  buildRestoredTranscript,
  episodeById,
  nextEpisodeId,
} from "./flow";

/** Minimal API item — only `answer` matters for restore routing. */
function item(answer: ApiBriefItem["answer"]): ApiBriefItem {
  return { name: "Q", question: "Question?", answer };
}

/** Exact `original` keys the FastAPI payload expects (schema.md). */
const SCHEMA_KEYS = [
  "additional_images_upload",
  "supporting_files_upload",
  "project_goals_or_brief_description",
  "landscape_design_style_preference",
  "hardscape_material_preferences",
  "softscape_planting_preferences",
  "budget",
  "important_proprty_information",
];

describe("EPISODES apiKey identifiers", () => {
  it("assigns a unique apiKey to every episode", () => {
    const keys = EPISODES.map((e) => e.apiKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps content only on non-card episodes (card.title renders instead)", () => {
    for (const ep of EPISODES) {
      if (ep.kind === "card") {
        expect(ep.content).toBeUndefined();
      } else {
        expect(typeof ep.content).toBe("string");
      }
    }
  });

  it("API-bound episodes use the exact schema.md keys, in order", () => {
    expect(API_QUESTIONS.map((q) => q.apiKey)).toEqual(SCHEMA_KEYS);
  });

  it("keeps friendly checklist ids separate from schema apiKeys", () => {
    expect(episodeById("project_goals_or_brief_description").checklistId).toBe(
      "goals"
    );
    expect(episodeById("important_proprty_information").checklistId).toBe(
      "restrictions"
    );
  });
});

describe("episodeById", () => {
  it("resolves every episode by its apiKey", () => {
    for (const ep of EPISODES) {
      expect(episodeById(ep.apiKey).apiKey).toBe(ep.apiKey);
    }
  });

  it("resolves every API-bound episode by its schema key", () => {
    for (const key of SCHEMA_KEYS) {
      expect(episodeById(key).api).toBeDefined();
    }
  });

  it("throws for the legacy id values", () => {
    expect(() => episodeById("photos-upload")).toThrow();
    expect(() => episodeById("files-upload")).toThrow();
    expect(() => episodeById("goals")).toThrow();
  });
});

describe("nextEpisodeId", () => {
  it("routes the photos branch to the upload episode", () => {
    expect(nextEpisodeId("photos", "Yes I do")).toBe("additional_images_upload");
    expect(nextEpisodeId("photos", "No I don't")).toBe("files");
  });

  it("routes the files branch to the upload episode", () => {
    expect(nextEpisodeId("files", "Yes I do")).toBe("supporting_files_upload");
    expect(nextEpisodeId("files", "No I don't")).toBe(
      "project_goals_or_brief_description"
    );
  });

  it("continues past the upload steps", () => {
    expect(nextEpisodeId("additional_images_upload")).toBe("files");
    expect(nextEpisodeId("supporting_files_upload")).toBe(
      "project_goals_or_brief_description"
    );
  });

  it("walks the full intake in schema-key order", () => {
    const chain = [
      "photos",
      "additional_images_upload",
      "files",
      "supporting_files_upload",
      "project_goals_or_brief_description",
      "landscape_design_style_preference",
      "hardscape_material_preferences",
      "softscape_planting_preferences",
      "budget",
      "important_proprty_information",
      "summary",
    ];
    const yesNo: Record<string, string> = { photos: "Yes I do", files: "Yes I do" };
    const got = [chain[0]];
    let current = chain[0];
    while (current !== "summary") {
      const next = nextEpisodeId(current, yesNo[current]);
      got.push(next);
      current = next;
      if (got.length > 20) break; // safety against an infinite loop
    }
    expect(got).toEqual(chain);
  });

  it("ends the revision loop at the revision summary", () => {
    expect(nextEpisodeId("revision")).toBe("revision-summary");
  });
});

describe("buildMessage", () => {
  it("derives message ids from the episode apiKey", () => {
    expect(buildMessage(episodeById("welcome")).id).toBe("ep-welcome");
    expect(buildMessage(episodeById("additional_images_upload")).id).toBe(
      "ep-additional_images_upload"
    );
    expect(buildMessage(episodeById("project_goals_or_brief_description")).id).toBe(
      "ep-project_goals_or_brief_description"
    );
  });

  it("uses the card title as the message content for card episodes", () => {
    const msg = buildMessage(episodeById("additional_images_upload"));
    expect(msg.content).toBe("Additional House Photos (Optional)");
  });
});

describe("buildRestoredTranscript", () => {
  it("returns just the welcome screen when nothing was answered", () => {
    const t = buildRestoredTranscript({});
    expect(t.messages.map((m) => m.id)).toEqual(["ep-welcome"]);
    expect(t.currentId).toBe("welcome");
  });

  it("resumes at the files question when only photos were uploaded", () => {
    const t = buildRestoredTranscript({
      additional_images_upload: item(["https://cdn/img1.jpg"]),
    });
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-photos");
    expect(ids).toContain("ep-additional_images_upload");
    expect(ids).not.toContain("ep-supporting_files_upload");
    expect(t.completed.has("photos")).toBe(true);
    expect(t.currentId).toBe("files");
  });

  it("skips the upload cards when the user said no to uploads", () => {
    const t = buildRestoredTranscript({
      project_goals_or_brief_description: item("change exterior"),
    });
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-photos");
    expect(ids).toContain("ep-project_goals_or_brief_description");
    expect(ids).not.toContain("ep-additional_images_upload");
    expect(ids).not.toContain("ep-supporting_files_upload");
    expect(t.currentId).toBe("landscape_design_style_preference");
  });

  it("reaches the summary when every question is answered", () => {
    const original: Record<string, ApiBriefItem> = {
      additional_images_upload: item(["https://cdn/img1.jpg"]),
      supporting_files_upload: item(["https://cdn/file.pdf"]),
      project_goals_or_brief_description: item("goals"),
      landscape_design_style_preference: item({ files: [], notes: "styles" }),
      hardscape_material_preferences: item({ files: [], notes: "hardscape" }),
      softscape_planting_preferences: item({ files: [], notes: "softscape" }),
      budget: item("$25,000-$50,000"),
      important_proprty_information: item({ value: ["Easements"], notes: "" }),
    };
    const t = buildRestoredTranscript(original);
    expect(t.currentId).toBe("summary");
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-summary");
    // Every API-bound card appears once, keyed by its schema apiKey.
    for (const key of SCHEMA_KEYS) {
      expect(ids).toContain(`ep-${key}`);
    }
    // Restored user bubbles map back to episode apiKeys.
    expect(Object.values(t.messageEpisodes).sort()).toEqual(
      ["photos", "files", ...SCHEMA_KEYS].sort()
    );
  });
});
