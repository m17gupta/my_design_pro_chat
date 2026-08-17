import { describe, expect, it } from "vitest";
import type { ApiBriefItem } from "../../lib/apiBrief";
import type { EnterpriseEntry } from "../../store/enterprise/enterpriseType";
import {
  API_QUESTIONS,
  EPISODES,
  buildColorMaterialEpisodes,
  buildEpisodes,
  buildMessage,
  buildRestoredTranscript,
  countRevisionRounds,
  episodeById,
  episodeMessageId,
  getApiQuestions,
  nextEpisodeId,
  revisionRoundFromMessage,
} from "./flow";
import type { Message } from "./types";

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

/** Keys the color/material question set sends (Questions.json → color-material). */
const COLOR_MATERIAL_KEYS = [
  "additional_images_upload",
  "supporting_files_upload",
  "project_goals_or_brief_description",
  "exterior_color_and_material_style",
  "primary_material_preferences",
  "color_preferences",
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

  it("routes the color-material chain through its three topic cards", () => {
    const eps = buildEpisodes("color-material");
    const chain = [
      "photos",
      "additional_images_upload",
      "files",
      "supporting_files_upload",
      "project_goals_or_brief_description",
      "exterior_color_and_material_style",
      "primary_material_preferences",
      "color_preferences",
      "budget",
      "important_proprty_information",
      "summary",
    ];
    const yesNo: Record<string, string> = { photos: "Yes I do", files: "Yes I do" };
    const got = [chain[0]];
    let current = chain[0];
    while (current !== "summary") {
      const next = nextEpisodeId(current, yesNo[current], eps);
      got.push(next);
      current = next;
      if (got.length > 20) break; // safety against an infinite loop
    }
    expect(got).toEqual(chain);
    // The landscape chain still routes identically without the episodes arg.
    expect(nextEpisodeId("project_goals_or_brief_description")).toBe(
      "landscape_design_style_preference"
    );
    expect(nextEpisodeId("project_goals_or_brief_description", undefined, eps)).toBe(
      "exterior_color_and_material_style"
    );
  });
});

describe("buildMessage", () => {
  it("derives message ids from the episode apiKey", () => {
    expect(buildMessage(episodeById("overview")).id).toBe("ep-overview");
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

describe("buildEpisodes", () => {
  it("keeps apiKeys and flow identical across work types", () => {
    for (const wt of ["front_yard", "rear_yard", "front-yard", undefined]) {
      const eps = buildEpisodes(wt);
      expect(eps.map((e) => e.apiKey)).toEqual(EPISODES.map((e) => e.apiKey));
      expect(getApiQuestions(eps).map((q) => q.apiKey)).toEqual(SCHEMA_KEYS);
    }
  });

  it("overrides rear_yard wording but keeps front_yard wording", () => {
    const rear = buildEpisodes("rear_yard");
    const rearGoals = rear.find(
      (e) => e.apiKey === "project_goals_or_brief_description"
    );
    expect(rearGoals?.card?.description).toMatch(/backyard/);
    expect(rearGoals?.api?.question).toMatch(/backyard/);

    const front = buildEpisodes("front_yard");
    const frontGoals = front.find(
      (e) => e.apiKey === "project_goals_or_brief_description"
    );
    expect(frontGoals?.card?.description).not.toMatch(/backyard/);
  });

  it("normalizes hyphenated work types to the JSON keys", () => {
    expect(buildEpisodes("front-yard")).toEqual(buildEpisodes("front_yard"));
  });

  it("renders HTML upload descriptions as readable text but keeps HTML for the API", () => {
    const eps = buildEpisodes("rear_yard");
    const upload = eps.find((e) => e.apiKey === "additional_images_upload");
    expect(upload?.card?.description).not.toMatch(/<p/);
    expect(upload?.card?.description).toMatch(/additional photos/);
    expect(upload?.api?.question).toMatch(/<p/);
  });

  it("falls back to the base episodes for unknown work types", () => {
    expect(buildEpisodes("bogus_type")).toEqual(EPISODES);
  });

  it("swaps the three topic cards for the color-material question set", () => {
    for (const wt of ["color-material", "color_material"]) {
      const eps = buildEpisodes(wt);
      const keys = eps.map((e) => e.apiKey);
      expect(keys).toContain("exterior_color_and_material_style");
      expect(keys).toContain("primary_material_preferences");
      expect(keys).toContain("color_preferences");
      expect(keys).not.toContain("landscape_design_style_preference");
      expect(keys).not.toContain("hardscape_material_preferences");
      expect(keys).not.toContain("softscape_planting_preferences");
      expect(getApiQuestions(eps).map((q) => q.apiKey)).toEqual(
        COLOR_MATERIAL_KEYS
      );
      // Non-topic episodes stay byte-identical to the base list.
      for (const shared of [
        "overview",
        "photos",
        "budget",
        "summary",
        "revision",
      ]) {
        expect(episodeById(shared, eps)).toEqual(episodeById(shared, EPISODES));
      }
    }
  });

  it("overlays color-material wording from Questions.json onto the new topic cards", () => {
    const eps = buildEpisodes("color-material");
    const exterior = eps.find(
      (e) => e.apiKey === "exterior_color_and_material_style"
    );
    expect(exterior?.card?.title).toBe("Exterior Color & Material Style");
    expect(exterior?.card?.description).toMatch(/exterior style/);
    expect(exterior?.api?.answerShape).toBe("files-notes");
    const colors = eps.find((e) => e.apiKey === "color_preferences");
    expect(colors?.card?.description).toMatch(/paint colors|colors/);
  });
});

describe("revision loop round ids", () => {
  it("builds round-suffixed message ids (round 1 keeps the base id)", () => {
    expect(episodeMessageId("revision", 1)).toBe("ep-revision");
    expect(episodeMessageId("revision", 2)).toBe("ep-revision-2");
    expect(episodeMessageId("revision-summary", 1)).toBe("ep-revision-summary");
    expect(episodeMessageId("revision-summary", 3)).toBe("ep-revision-summary-3");
  });

  it("counts revision comment cards without counting their summaries", () => {
    const ids = [
      "ep-overview",
      "ep-revision",
      "ep-revision-summary",
      "ep-revision-2",
      "ep-revision-summary-2",
      "ep-revision-3",
      "ep-revision-summary-3",
    ];
    expect(
      countRevisionRounds(ids.map((id) => ({ id } as Pick<Message, "id">)))
    ).toBe(3);
    expect(
      countRevisionRounds(
        [{ id: "ep-revision-summary" } as Pick<Message, "id">]
      )
    ).toBe(0);
  });

  it("derives the round from a revision-summary message id", () => {
    expect(revisionRoundFromMessage("ep-revision-summary")).toBe(1);
    expect(revisionRoundFromMessage("ep-revision-summary-2")).toBe(2);
    expect(revisionRoundFromMessage("ep-revision-summary-3")).toBe(3);
    expect(revisionRoundFromMessage("ep-revision")).toBe(0);
    expect(revisionRoundFromMessage("ep-summary")).toBe(0);
  });

  it("simulates a 3-round loop with unique per-round message ids", () => {
    // Round 1: regenerate → comments → summary.
    let ids: Pick<Message, "id">[] = [];
    for (let round = 1; round <= 3; round += 1) {
      ids = [
        ...ids,
        { id: episodeMessageId("revision", round) },
        { id: episodeMessageId("revision-summary", countRevisionRounds(ids) + 1) },
      ];
    }
    const allIds = ids.map((m) => m.id);
    expect(allIds).toEqual([
      "ep-revision",
      "ep-revision-summary",
      "ep-revision-2",
      "ep-revision-summary-2",
      "ep-revision-3",
      "ep-revision-summary-3",
    ]);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("buildRestoredTranscript", () => {
  it("returns just the overview screen when nothing was answered", () => {
    const t = buildRestoredTranscript({});
    expect(t.messages.map((m) => m.id)).toEqual(["ep-overview"]);
    expect(t.currentId).toBe("overview");
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

  it("uses work-type episodes text when restoring a transcript", () => {
    const rear = buildEpisodes("rear_yard");
    const t = buildRestoredTranscript(
      { project_goals_or_brief_description: item("backyard deck") },
      [],
      rear
    );
    const card = t.messages.find(
      (m) => m.id === "ep-project_goals_or_brief_description"
    );
    expect(card?.card?.description).toMatch(/backyard/);
  });

  it("restores a color-material transcript with its own topic keys", () => {
    const eps = buildColorMaterialEpisodes();
    const original: Record<string, ApiBriefItem> = {
      additional_images_upload: item(["https://cdn/img1.jpg"]),
      supporting_files_upload: item(["https://cdn/file.pdf"]),
      project_goals_or_brief_description: item("repaint the front"),
      exterior_color_and_material_style: item({ files: [], notes: "modern farmhouse" }),
      primary_material_preferences: item({ files: [], notes: "brick and siding" }),
      color_preferences: item({ files: [], notes: "deep navy" }),
      budget: item("$50,000-$75,000"),
      important_proprty_information: item({ value: ["HOA requirements"], notes: "" }),
    };
    const t = buildRestoredTranscript(original, [], eps);
    expect(t.currentId).toBe("summary");
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-exterior_color_and_material_style");
    expect(ids).toContain("ep-primary_material_preferences");
    expect(ids).toContain("ep-color_preferences");
    expect(ids).not.toContain("ep-landscape_design_style_preference");
    // User bubbles still map back to their (color-material) episode keys.
    expect(Object.values(t.messageEpisodes).sort()).toEqual(
      ["photos", "files", ...COLOR_MATERIAL_KEYS].sort()
    );
  });

  it("resumes at the next color-material topic after a partial answer", () => {
    const eps = buildColorMaterialEpisodes();
    const t = buildRestoredTranscript(
      {
        additional_images_upload: item(["https://cdn/img1.jpg"]),
        project_goals_or_brief_description: item("goals"),
        exterior_color_and_material_style: item({ files: [], notes: "style" }),
      },
      [],
      eps
    );
    expect(t.currentId).toBe("primary_material_preferences");
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

  /** A fully-answered intake, so the transcript resumes at the summary. */
  function fullIntake(): Record<string, ApiBriefItem> {
    return {
      additional_images_upload: item(["https://cdn/img1.jpg"]),
      supporting_files_upload: item(["https://cdn/file.pdf"]),
      project_goals_or_brief_description: item("goals"),
      landscape_design_style_preference: item({ files: [], notes: "styles" }),
      hardscape_material_preferences: item({ files: [], notes: "hardscape" }),
      softscape_planting_preferences: item({ files: [], notes: "softscape" }),
      budget: item("$25,000-$50,000"),
      important_proprty_information: item({ value: ["Easements"], notes: "" }),
    };
  }

  /** One revision history entry, mirroring revisonSchema.md. */
  function revisionEntry(notes: string, files: string[] = []): EnterpriseEntry {
    return {
      id: `rev-${notes}`,
      url: "https://cdn/rev.png",
      status: "completed",
      type: "revision",
      questions: [{ name: "Revision Comments", type: "text", details: "", answer: { files, notes } }],
    };
  }

  it("restores a pending revision round from revision_comment when no entry exists yet", () => {
    const t = buildRestoredTranscript(fullIntake(), [], undefined, {
      files: ["https://cdn/ref.jpg"],
      notes: "please make it bigger",
    });
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-summary");
    expect(ids).toContain("ep-revision");
    expect(ids).toContain("ep-revision-summary");
    expect(t.currentId).toBe("revision-summary");
    // The user bubble carries the pending notes.
    const userMsg = t.messages.find((m) => m.id === "m-restored-ep-revision");
    expect(userMsg?.content).toBe("please make it bigger");
    // No entry yet — the round is pending, not completed.
    expect(ids.filter((id) => id.startsWith("ep-revision-summary")).length).toBe(1);
  });

  it("does not add a pending round when revision_comment matches the last completed round", () => {
    const t = buildRestoredTranscript(
      fullIntake(),
      [revisionEntry("make it bigger", ["https://cdn/ref.jpg"])],
      undefined,
      { files: ["https://cdn/ref.jpg"], notes: "make it bigger" }
    );
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-revision");
    expect(ids).toContain("ep-revision-summary");
    expect(ids).not.toContain("ep-revision-2");
    expect(ids).not.toContain("ep-revision-summary-2");
  });

  it("adds a pending round after completed rounds when the comment is new", () => {
    const t = buildRestoredTranscript(
      fullIntake(),
      [revisionEntry("make it bigger")],
      undefined,
      { files: [], notes: "now move the patio" }
    );
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-revision");
    expect(ids).toContain("ep-revision-summary");
    expect(ids).toContain("ep-revision-2");
    expect(ids).toContain("ep-revision-summary-2");
    expect(t.currentId).toBe("revision-summary");
    const userMsg = t.messages.find((m) => m.id === "m-restored-ep-revision-2");
    expect(userMsg?.content).toBe("now move the patio");
  });

  it("ignores an empty revision_comment", () => {
    const t = buildRestoredTranscript(fullIntake(), [], undefined, {
      files: [],
      notes: "",
    });
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-summary");
    expect(ids).not.toContain("ep-revision-summary");
    expect(t.currentId).toBe("summary");
  });
});
