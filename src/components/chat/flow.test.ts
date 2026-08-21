import { describe, expect, it } from "vitest";
import type { ApiBriefItem } from "../../lib/apiBrief";
import type { EnterpriseEntry } from "../../store/enterprise/enterpriseType";
import {
  EPISODES,
  buildColorMaterialEpisodes,
  buildEpisodes,
  buildEpisodesFromContext,
  buildMessage,
  buildRestoredTranscript,
  checklistFromFlowContext,
  formatQuestionIdAsName,
  countRevisionRounds,
  episodeById,
  episodeMessageId,
  getApiQuestions,
  nextEpisodeId,
  revisionApiKey,
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

/** Keys the arc-addition question set sends (Questions.json → color-material). */
const ARC_KEYS = [
  "additional_images_upload",
  "supporting_files_upload",
  "project_goals_or_brief_description",
  "type_of_architectural_project",
  "architectural_style_preference",
  "exterior_materials_and_finishes",
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
    expect(getApiQuestions(EPISODES).map((q) => q.apiKey)).toEqual(SCHEMA_KEYS);
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

  it("preserves HTML in upload descriptions for the card and API", () => {
    const eps = buildEpisodes("rear_yard");
    const upload = eps.find((e) => e.apiKey === "additional_images_upload");
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

  it("swaps the three topic cards for the arc-addition question set", () => {
    for (const wt of ["arc-addition", "arc_addition"]) {
      const eps = buildEpisodes(wt);
      const keys = eps.map((e) => e.apiKey);
      expect(keys).toContain("type_of_architectural_project");
      expect(keys).toContain("architectural_style_preference");
      expect(keys).toContain("exterior_materials_and_finishes");
      expect(keys).not.toContain("landscape_design_style_preference");
      expect(keys).not.toContain("hardscape_material_preferences");
      expect(keys).not.toContain("softscape_planting_preferences");
      expect(getApiQuestions(eps).map((q) => q.apiKey)).toEqual(ARC_KEYS);
      // Untouched episodes stay byte-identical to the base list (budget is
      // excluded: the arc JSON rewrites its wording, matching base layout).
      for (const shared of ["overview", "photos", "summary", "revision"]) {
        expect(episodeById(shared, eps)).toEqual(episodeById(shared, EPISODES));
      }
    }
  });

  it("overlays arc-addition wording from Questions.json onto the new topic cards", () => {
    const eps = buildEpisodes("arc_addition");
    const projectType = eps.find((e) => e.apiKey === "type_of_architectural_project");
    expect(projectType?.card?.title).toBe("Type of Architectural Project");
    expect(projectType?.card?.description).toMatch(/architectural changes/);
    expect(projectType?.api?.answerShape).toBe("value-notes");
    const style = eps.find((e) => e.apiKey === "architectural_style_preference");
    expect(style?.card?.description).toMatch(/architectural style/);
    expect(style?.api?.answerShape).toBe("files-notes");
    const materials = eps.find((e) => e.apiKey === "exterior_materials_and_finishes");
    expect(materials?.card?.description).toMatch(/exterior materials/);
  });

  it("applies the whole_property goals override after the JSON id typo fix", () => {
    const whole = buildEpisodes("whole_property");
    const goals = whole.find((e) => e.apiKey === "project_goals_or_brief_description");
    // The JSON override text mentions the property as a whole (not a specific side).
    expect(goals?.card?.description).toMatch(/accomplish with your property/);
  });

  it("sources the custom work type's id/name/details from CustomQuestions.json", () => {
    const custom = buildEpisodes("custom");
    const goals = custom.find((e) => e.apiKey === "project_goals_or_brief_description");
    // CustomQuestions.json custom wording, not the Questions.json default.
    expect(goals?.card?.description).toMatch(/brief overview of what you are looking to do/);
    // The upload question is renamed "Inspirational Photos" with new details.
    const photos = custom.find((e) => e.apiKey === "additional_images_upload");
    expect(photos?.card?.title).toBe("Inspirational Photos");
    expect(photos?.card?.description).toMatch(/inspirational photos/);
    expect(photos?.api?.name).toBe("Inspirational Photos");
  });

  it("leaves the custom flow unchanged when engageDesigner is off/absent", () => {
    const plain = buildEpisodes("custom");
    expect(buildEpisodes("custom", { engageDesigner: false })).toEqual(plain);
    expect(buildEpisodes("custom", { engageDesigner: false, dcName: "Brooke Edwards" })).toEqual(plain);
  });

  it("swaps the engage-designer copy onto the goals question with the designer's name", () => {
    const eps = buildEpisodes("custom", {
      engageDesigner: true,
      dcName: "Brooke Edwards",
    });
    const goals = eps.find((e) => e.apiKey === "project_goals_or_brief_description");
    expect(goals?.card?.description).toBe(
      "Ok, great. I will get you over to Brooke Edwards. First, please give me a quick description of what it is you are looking to do on this project so I can let Brooke Edwards know"
    );
    // The API question mirrors the card text.
    expect(goals?.api?.question).toBe(goals?.card?.description);
    // Card title and answer shape stay as CustomQuestions.json defines them.
    expect(goals?.card?.title).toBe("Project Goals/Brief Description");
    expect(goals?.api?.answerShape).toBe("text");
  });

  it("falls back to 'your designer' when dcName is blank", () => {
    const eps = buildEpisodes("custom", { engageDesigner: true, dcName: "  " });
    const goals = eps.find((e) => e.apiKey === "project_goals_or_brief_description");
    expect(goals?.card?.description).toContain("I will get you over to your designer");
    expect(goals?.card?.description).toContain("so I can let your designer know");
  });

  it("swaps the photo question copy for the engage-designer flow", () => {
    const eps = buildEpisodes("custom", {
      engageDesigner: true,
      dcName: "Brooke Edwards",
    });
    const photos = eps.find((e) => e.apiKey === "additional_images_upload");
    expect(photos?.card?.description).toMatch(/To ensure efficiency, can you please upload any additional photo angles/);
    expect(photos?.api?.question).toBe(photos?.card?.description);
    // Layout/answer shape untouched.
    expect(photos?.card?.title).toBe("Inspirational Photos");
    expect(photos?.api?.answerShape).toBe("urls");
    // custom engage designer flow maps summary -> custom_engage_continue.
    expect(eps.map((e) => e.apiKey)).toEqual([
      "project_goals_or_brief_description",
      "additional_images_upload",
      "custom_engage_continue",
      "revision",
      "revision-summary",
    ]);
  });

  it("never applies engage-designer copy to non-custom work types", () => {
    const front = buildEpisodes("front_yard", {
      engageDesigner: true,
      dcName: "Brooke Edwards",
    });
    const goals = front.find((e) => e.apiKey === "project_goals_or_brief_description");
    expect(goals?.card?.description).not.toMatch(/I will get you over to/);
    expect(front).toEqual(buildEpisodes("front_yard"));
  });
});

describe("Work type episode resolution", () => {
  const WORK_TYPES = [
    "front_yard",
    "rear_yard",
    "whole_property",
    "color_material",
    "arc_addition",
    "custom",
    "value_added_services",
  ];

  it("builds valid episodes for every supported work type", () => {
    for (const wt of WORK_TYPES) {
      const eps = buildEpisodes(wt);
      expect(eps).toBeDefined();
      expect(eps.length).toBeGreaterThan(0);
    }
  });

  it("resolves every episode in every family to a valid catalog episode", () => {
    for (const wt of WORK_TYPES) {
      const eps = buildEpisodes(wt);
      for (const ep of eps) {
        expect(episodeById(ep.apiKey).apiKey).toBe(ep.apiKey);
      }
    }
  });

  it("keeps landscape variants on the base episode list structure", () => {
    const base = EPISODES.map((e) => e.apiKey);
    for (const wt of ["front_yard", "rear_yard", "whole_property", "value_added_services"]) {
      expect(buildEpisodes(wt).map((e) => e.apiKey)).toEqual(base);
    }
  });

  it("keeps every family array identical except the three topic slots", () => {
    const base = EPISODES.map((e) => e.apiKey);
    for (const wt of WORK_TYPES) {
      if (wt === "custom") continue;
      const keys = buildEpisodes(wt).map((e) => e.apiKey);
      expect(keys.length).toBe(base.length);
      const nonTopic = keys.filter((k) => !ALL_TOPIC_KEYS.includes(k));
      const baseNonTopic = base.filter((k) => !ALL_TOPIC_KEYS.includes(k));
      expect(nonTopic).toEqual(baseNonTopic);
    }
  });

  it("sources the custom flow's apiKeys from CustomQuestions.json", () => {
    const custom = buildEpisodes("custom");
    // Self-contained 5-step flow — no overview/photos/files/budget steps.
    expect(custom.map((e) => e.apiKey)).toEqual([
      "project_goals_or_brief_description",
      "additional_images_upload",
      "summary",
      "revision",
      "revision-summary",
    ]);
  });

  it("has exactly one topic set per family (landscape / color-material / arc)", () => {
    expect(
      buildEpisodes("front_yard")
        .map((e) => e.apiKey)
        .filter((k) => ALL_TOPIC_KEYS.includes(k))
    ).toEqual(LANDSCAPE_TOPIC_KEYS);
    expect(
      buildEpisodes("color_material")
        .map((e) => e.apiKey)
        .filter((k) => ALL_TOPIC_KEYS.includes(k))
    ).toEqual(COLOR_MATERIAL_TOPIC_KEYS);
    expect(
      buildEpisodes("arc_addition")
        .map((e) => e.apiKey)
        .filter((k) => ALL_TOPIC_KEYS.includes(k))
    ).toEqual(ARC_TOPIC_KEYS);
  });
});

/** Every topic-card apiKey across the three families. */
const ALL_TOPIC_KEYS = [
  "landscape_design_style_preference",
  "hardscape_material_preferences",
  "softscape_planting_preferences",
  "exterior_color_and_material_style",
  "primary_material_preferences",
  "color_preferences",
  "type_of_architectural_project",
  "architectural_style_preference",
  "exterior_materials_and_finishes",
];

const LANDSCAPE_TOPIC_KEYS = ALL_TOPIC_KEYS.slice(0, 3);
const COLOR_MATERIAL_TOPIC_KEYS = ALL_TOPIC_KEYS.slice(3, 6);
const ARC_TOPIC_KEYS = ALL_TOPIC_KEYS.slice(6, 9);

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

  it("shows the first card when a custom session has no answers yet", () => {
    const eps = buildEpisodes("custom");
    const t = buildRestoredTranscript({}, [], eps);
    expect(t.messages.map((m) => m.id)).toEqual([
      "ep-project_goals_or_brief_description",
    ]);
    expect(t.currentId).toBe("project_goals_or_brief_description");
  });

  it("restores a custom transcript starting at the first card (no overview)", () => {
    const eps = buildEpisodes("custom");
    const t = buildRestoredTranscript(
      { project_goals_or_brief_description: item("a custom remodel") },
      [],
      eps
    );
    const ids = t.messages.map((m) => m.id);
    expect(ids).toEqual([
      "ep-project_goals_or_brief_description",
      "m-restored-project_goals_or_brief_description",
      // Resume point — the inspirational-photos card, rendered as restored.
      "ep-additional_images_upload",
    ]);
    expect(ids).not.toContain("ep-overview");
    expect(t.currentId).toBe("additional_images_upload");
  });

  it("reaches the summary when every custom question is answered", () => {
    const eps = buildEpisodes("custom");
    const t = buildRestoredTranscript(
      {
        project_goals_or_brief_description: item("a custom remodel"),
        additional_images_upload: item(["https://cdn/img1.jpg"]),
      },
      [],
      eps
    );
    expect(t.currentId).toBe("summary");
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-summary");
    expect(ids).not.toContain("ep-photos");
    expect(ids).not.toContain("ep-files");
  });

  it("pushes the continue button episode when restoring a custom engage designer session", () => {
    const eps = buildEpisodes("custom", { engageDesigner: true });
    expect(nextEpisodeId("additional_images_upload", undefined, eps)).toBe("custom_engage_continue");

    const t = buildRestoredTranscript(
      {
        project_goals_or_brief_description: item("a custom remodel"),
        additional_images_upload: item(["https://cdn/img1.jpg"]),
      },
      [],
      eps,
      { files: [], notes: "" },
      { engageDesigner: true, work_type: "custom" }
    );
    expect(t.currentId).toBe("custom_engage_continue");
    const ids = t.messages.map((m) => m.id);
    expect(ids).not.toContain("ep-summary");
    expect(ids).toContain("ep-custom_engage_continue");

    const continueMsg = t.messages.find((m) => m.id === "ep-custom_engage_continue");
    expect(continueMsg?.content).toBe(
      "Thank you for providing the project information. Please review the details and submit your project to proceed."
    );
    expect(continueMsg?.options).toEqual(["Proceed"]);
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

describe("buildEpisodesFromContext (Dynamic Questionnaires)", () => {
  /** Enterprise color-material intake: role → user_type → work_type → phases. */
  const ENTERPRISE_CM = {
    role: "enterprise",
    user_type: "color-material",
    work_type: "color_material",
    question_sets: { original: ["phase_1"], revision: ["phase_4"] },
  };

  const MOCK_QUESTIONNAIRES = {
    enterprise: {
      "color-material": {
        color_material: {
          phase_1: {
            title: "Color and Materials",
            questions: [
              { id: "additional_images_upload", type: "file", name: "Additional House Photos", details: "<p>First, do you have any additional photo angles?</p>" },
              { id: "project_goals_or_brief_description", type: "textarea", name: "Project Goals/Brief Description", details: "In a few sentences, tell me what you'd love to accomplish with this project.  Note- I will ask you about specific colors/materials in a minute.  Just a broad overview here is what I need" },
              { id: "exterior_color_and_material_style", type: "files_with_description", name: "Exterior Style" },
              { id: "primary_material_preferences", type: "files_with_description", name: "Primary Material and Color Preferences" },
              { id: "budget", type: "radio", name: "Budget", options: ["Under $25,000", "$25,000-$50,000"] },
              { id: "important_proprty_information", type: "checkbox_with_notes", name: "Important Property Information", options: ["HOA requirements"] },
            ],
          },
          phase_2: {
            title: "DESIGN SUMMARY",
            questions: [
              { id: "design_summary", type: "display", name: "Design Summary", details: "Amazing, I have logged our discussion" },
              { id: "design_direction_approval", type: "radio", name: "Design Direction Approval" },
            ],
          },
          phase_4: {
            title: "Revision Requests",
            questions: [
              { id: "revision_comments", type: "files_with_description", name: "Revision Comments" },
              { id: "revision_design_summary", type: "display", name: "Revision Design Summary", details: "Based on your answers, Luna will create a revised design featuring:" },
            ],
          },
        },
        custom: {
          phase_1: {
            title: "Custom Request",
            questions: [
              { id: "project_goals_or_brief_description", type: "textarea", name: "Project Goals/Brief Description", details: "Give me a brief overview of what you are looking to do?" },
              { id: "additional_images_upload", type: "file", name: "Inspirational Photos", details: "<p>Do you have any inspirational photos?</p>" },
            ],
          },
          phase_2: {
            title: "DESIGN SUMMARY",
            questions: [
              { id: "design_summary", type: "display", name: "Design Summary" },
              { id: "design_direction_approval", type: "radio", name: "Design Direction Approval" },
            ],
          },
          phase_3: {
            title: "RENDERING REVIEW",
            questions: [{ id: "render_satisfaction", type: "display", name: "Initial Reaction" }],
          },
          phase_4: {
            title: "Revision Requests",
            questions: [
              { id: "revision_comments", type: "files_with_description", name: "Feedback" },
              { id: "revision_design_summary", type: "display", name: "Design Summary" },
            ],
          },
        },
      },
      "landscape-design": {
        front_yard: {
          phase_1: {
            title: "Front Yard Design",
            questions: [
              { id: "additional_images_upload", type: "file", name: "Additional House Photos" },
              { id: "supporting_files_upload", type: "file", name: "Supporting Files Upload" },
              { id: "project_goals_or_brief_description", type: "textarea", name: "Project Goals/Brief Description" },
              { id: "landscape_design_style_preference", type: "files_with_description", name: "Landscape Design Style Preference" },
              { id: "hardscape_material_preferences", type: "files_with_description", name: "Hardscape / Material Preferences" },
              { id: "softscape_planting_preferences", type: "files_with_description", name: "Softscape / Planting Preferences" },
              { id: "budget", type: "radio", name: "Budget", options: ["Under $25,000"] },
              { id: "important_proprty_information", type: "checkbox_with_notes", name: "Important Property Information", options: ["HOA requirements"] },
            ],
          },
          phase_2: {
            title: "DESIGN SUMMARY",
            questions: [
              { id: "design_summary", type: "display", name: "Design Summary", details: "Amazing, I have logged our discussion" },
              { id: "design_direction_approval", type: "radio", name: "Design Direction Approval" },
            ],
          },
          phase_4: {
            title: "Revision Requests",
            questions: [
              { id: "revision_comments", type: "files_with_description", name: "Revision Comments" },
              { id: "revision_design_summary", type: "display", name: "Revision Design Summary" },
            ],
          },
        },
        rear_yard: {
          phase_1: {
            title: "Rear Yard Design",
            questions: [
              { id: "additional_images_upload", type: "file", name: "Additional House Photos" },
              { id: "supporting_files_upload", type: "file", name: "Supporting Files Upload" },
              { id: "project_goals_or_brief_description", type: "textarea", name: "Project Goals/Brief Description" },
            ],
          },
          phase_4: {
            title: "Revision Requests",
            questions: [
              { id: "revision_comments", type: "files_with_description", name: "Revision Comments" },
            ],
          },
        },
        whole_property: {
          phase_1: {
            title: "Whole Property Design",
            questions: [
              { id: "additional_images_upload", type: "file", name: "Additional House Photos" },
              { id: "supporting_files_upload", type: "file", name: "Supporting Files Upload" },
              { id: "project_goals_or__brief_description", type: "textarea", name: "Project Goals/Brief Description" },
            ],
          },
          phase_4: {
            title: "Revision Requests",
            questions: [
              { id: "revision_comments", type: "files_with_description", name: "Revision Comments" },
            ],
          },
        },
      },
    },
    "enterprise-client": {
      "landscape-design": {
        phase_1: {
          title: "SITE ASSESSMENT",
          questions: [
            { id: "property_verified", type: "radio", name: "Verify Property" },
            { id: "primary_uses", type: "checkbox", name: "Primary Uses" },
            {
              id: "ai_site_assessment",
              type: "multi_questions",
              name: "AI Site Assessment",
              multi_questions: [
                { id: "ai_site_assessment_existing_conditions", type: "checkbox", name: "Existing Conditions" },
                { id: "ai_site_assessment_opportunities", type: "checkbox", name: "Opportunities" },
                { id: "ai_site_assessment_potential_constraints", type: "checkbox", name: "Potential Constraints" },
              ],
            },
          ],
        },
        phase_2: {
          title: "SUMMARY",
          questions: [
            { id: "summary", type: "display", name: "Summary" },
          ],
        },
        phase_5: {
          title: "REVISION",
          questions: [
            { id: "architecture_changes", type: "textarea", name: "Architecture Changes" },
            { id: "hardscape_changes", type: "textarea", name: "Hardscape Changes" },
            { id: "landscape_changes", type: "textarea", name: "Landscape Changes" },
            { id: "material_changes", type: "textarea", name: "Material Changes" },
            { id: "other_revision_notes", type: "textarea", name: "Other Revision Notes" },
            { id: "revision_approval", type: "radio", name: "Revision Approval", is_ai_design: true },
            { id: "revision-summary", type: "display", name: "Revision Summary" },
          ],
        },
      },
    },
  };

  it("uses dynamic API questionnaires when provided", () => {
    const dynamicData = {
      enterprise: {
        "color-material": {
          color_material: {
            p1: {
              title: "API Dynamic Phase",
              questions: [
                { id: "api_q1", name: "Dynamic API Question", type: "radio", options: ["A", "B"] },
              ],
            },
          },
        },
      },
    };
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "color-material",
        work_type: "color_material",
        question_sets: { original: ["p1"], revision: [] },
      },
      dynamicData
    );
    expect(eps.map((e) => e.apiKey)).toEqual(["overview", "api_q1", "summary", "api_q1"]);
  });

  it("falls back to the legacy flow when the role has no AllQuestion.json path", () => {
    expect(buildEpisodesFromContext({ role: "homeowner", work_type: "front_yard" })).toEqual(
      buildEpisodes("front_yard")
    );
    expect(buildEpisodesFromContext({ work_type: "custom" })).toEqual(
      buildEpisodes("custom")
    );
    expect(buildEpisodesFromContext({ work_type: "front-yard" })).toEqual(
      buildEpisodes("front_yard")
    );
  });

  it("builds the enterprise intake from question_sets.original phases", () => {
    const eps = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    expect(eps.map((e) => e.apiKey)).toEqual([
      "overview",
      "photos",
      "additional_images_upload",
      "project_goals_or_brief_description",
      "exterior_color_and_material_style",
      "primary_material_preferences",
      "budget",
      "important_proprty_information",
      "summary",
      "revision",
      "revision-summary",
    ]);
  });

  it("maps each JSON question type to the right card field and answer shape", () => {
    const eps = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    const goals = eps.find((e) => e.apiKey === "project_goals_or_brief_description");
    expect(goals?.card?.fields[0].kind).toBe("textarea");
    expect(goals?.api?.answerShape).toBe("text");
    const style = eps.find((e) => e.apiKey === "exterior_color_and_material_style");
    expect(style?.card?.fields.map((f) => f.kind)).toEqual(["textarea", "upload-grid"]);
    expect(style?.api?.answerShape).toBe("files-notes");
    const budget = eps.find((e) => e.apiKey === "budget");
    expect(budget?.card?.fields[0].kind).toBe("radio");
    expect((budget?.card?.fields[0] as { options: string[] }).options).toContain("Under $25,000");
    const info = eps.find((e) => e.apiKey === "important_proprty_information");
    expect(info?.card?.fields[0].kind).toBe("checkbox");
    expect(info?.api?.answerShape).toBe("value-notes");
  });

  it("carries the AllQuestion.json wording onto the card and API question", () => {
    const eps = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    const goals = eps.find((e) => e.apiKey === "project_goals_or_brief_description");
    expect(goals?.card?.title).toBe("Project Goals/Brief Description");
    expect(goals?.card?.description).toMatch(/colors\/materials/);
    expect(goals?.api?.question).toBe(
      "In a few sentences, tell me what you'd love to accomplish with this project.  Note- I will ask you about specific colors/materials in a minute.  Just a broad overview here is what I need"
    );
    const photos = eps.find((e) => e.apiKey === "additional_images_upload");
    expect(photos?.card?.description).toMatch(/additional photo/);
    expect(photos?.api?.question).toMatch(/<p/);
  });

  it("defaults question_sets to intake-through-approval plus the last revision phase", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "front_yard",
      },
      MOCK_QUESTIONNAIRES
    );
    const keys = eps.map((e) => e.apiKey);
    expect(keys.length).toBe(14);
    expect(keys[0]).toBe("overview");
    expect(keys[keys.length - 2]).toBe("revision");
    expect(keys[keys.length - 1]).toBe("revision-summary");
    expect(eps.find((e) => e.apiKey === "summary")?.content).toMatch(/Amazing, I have logged our discussion/);
  });

  it("gates the upload cards behind Yes/No intro questions on enterprise yard flows", () => {
    for (const wt of ["front_yard", "rear_yard", "whole_property"]) {
      const eps = buildEpisodesFromContext(
        {
          role: "enterprise",
          user_type: "landscape-design",
          work_type: wt,
          question_sets: { original: ["phase_1"], revision: ["phase_4"] },
        },
        MOCK_QUESTIONNAIRES
      );
      const keys = eps.map((e) => e.apiKey);
      const photos = keys.indexOf("photos");
      const files = keys.indexOf("files");
      expect(photos).toBeGreaterThanOrEqual(0);
      expect(files).toBeGreaterThan(photos);
      expect(keys[photos + 1]).toBe("additional_images_upload");
      expect(keys[files + 1]).toBe("supporting_files_upload");
      const photosEp = eps[photos];
      expect(photosEp?.options).toEqual(["Yes I do", "No I don't"]);
      const photosCard = eps.find((e) => e.apiKey === "additional_images_upload");
      expect(photosEp?.checklistId).toBe(photosCard?.checklistId);
      const filesEp = eps[files];
      expect(filesEp?.options).toEqual(["Yes I do", "No I don't"]);
      const filesCard = eps.find((e) => e.apiKey === "supporting_files_upload");
      expect(filesEp?.checklistId).toBe(filesCard?.checklistId);
    }
  });

  it("routes the upload gates through the Yes/No branches on yard flows", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "front_yard",
        question_sets: { original: ["phase_1"], revision: ["phase_4"] },
      },
      MOCK_QUESTIONNAIRES
    );
    expect(nextEpisodeId("photos", "Yes I do", eps)).toBe("additional_images_upload");
    expect(nextEpisodeId("photos", "No I don't", eps)).toBe("files");
    expect(nextEpisodeId("files", "Yes I do", eps)).toBe("supporting_files_upload");
    expect(nextEpisodeId("files", "No I don't", eps)).toBe(
      "project_goals_or_brief_description"
    );
    const whole = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "whole_property",
        question_sets: { original: ["phase_1"], revision: ["phase_4"] },
      },
      MOCK_QUESTIONNAIRES
    );
    expect(nextEpisodeId("files", "No I don't", whole)).toBe(
      "project_goals_or__brief_description"
    );
  });

  it("gates uploads on any flow containing the upload questions", () => {
    const cm = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    const keys = cm.map((e) => e.apiKey);
    const photos = keys.indexOf("photos");
    expect(photos).toBeGreaterThanOrEqual(0);
    expect(keys[photos + 1]).toBe("additional_images_upload");
    // This questionnaire has no supporting_files_upload → no files gate.
    expect(keys).not.toContain("files");
  });

  it("does not gate uploads when the questionnaire lacks the upload questions", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise-client",
        user_type: "landscape-design",
        question_sets: { original: ["phase_1", "phase_2"], revision: ["phase_5"] },
      },
      MOCK_QUESTIONNAIRES
    );
    expect(eps.map((e) => e.apiKey)).not.toContain("photos");
    expect(eps.map((e) => e.apiKey)).not.toContain("files");
  });

  it("restores a gated yard flow with the photo branch", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "rear_yard",
        question_sets: { original: ["phase_1"], revision: ["phase_4"] },
      },
      MOCK_QUESTIONNAIRES
    );
    const t = buildRestoredTranscript(
      { additional_images_upload: item(["https://cdn/img1.jpg"]) },
      [],
      eps
    );
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-photos");
    expect(ids).toContain("ep-additional_images_upload");
    expect(t.currentId).toBe("files");
    // Gate's checklistId now matches the target upload card's checklistId.
    expect(t.completed.has("additional_images_upload")).toBe(true);
  });

  it("builds the enterprise-client flow without a work_type level", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise-client",
        user_type: "landscape-design",
        question_sets: { original: ["phase_1", "phase_2"], revision: ["phase_5"] },
      },
      MOCK_QUESTIONNAIRES
    );
    const keys = eps.map((e) => e.apiKey);
    expect(keys).toContain("property_verified");
    expect(keys).toContain("primary_uses");
    expect(keys).toContain("summary");
    expect(keys).toContain("architecture_changes");
    expect(keys).toContain("revision-summary");
    expect(keys).not.toContain("revision_approval");
  });

  it("flattens multi_questions into child episodes", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise-client",
        user_type: "landscape-design",
        question_sets: { original: ["phase_1"], revision: ["phase_5"] },
      },
      MOCK_QUESTIONNAIRES
    );
    const keys = eps.map((e) => e.apiKey);
    expect(keys).toContain("ai_site_assessment_existing_conditions");
    expect(keys).toContain("ai_site_assessment_opportunities");
    expect(keys).toContain("ai_site_assessment_potential_constraints");
    const child = eps.find((e) => e.apiKey === "ai_site_assessment_opportunities");
    expect(child?.api?.answerShape).toBe("value-notes");
  });

  it("marks revision-phase episodes and keeps the canonical revision card id", () => {
    const eps = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    const revision = eps.find((e) => e.apiKey === "revision");
    expect(revision?.revisionStep).toBe(true);
    expect(revision?.api).toBeUndefined();
    expect(revisionApiKey(eps)).toBe("revision");
    expect(eps.find((e) => e.apiKey === "revision-summary")?.content).toMatch(/revised design/);
  });

  it("uses the first revision-phase question as the revision key when not revision_comments", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise-client",
        user_type: "landscape-design",
        question_sets: { original: ["phase_1"], revision: ["phase_5"] },
      },
      MOCK_QUESTIONNAIRES
    );
    expect(revisionApiKey(eps)).toBe("architecture_changes");
    const others = eps.filter((e) => e.revisionStep && e.apiKey !== "architecture_changes");
    expect(others.map((e) => e.apiKey).sort()).toEqual([
      "hardscape_changes",
      "landscape_changes",
      "material_changes",
      "other_revision_notes",
    ]);
  });

  it("applies the engage-designer variant only on the enterprise custom flow", () => {
    const custom = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "color-material",
        work_type: "custom",
        engageDesigner: true,
        dcName: "Brooke Edwards",
        question_sets: { original: ["phase_1"], revision: ["phase_4"] },
      },
      MOCK_QUESTIONNAIRES
    );
    const goals = custom.find((e) => e.apiKey === "project_goals_or_brief_description");
    expect(goals?.card?.description).toContain("Brooke Edwards");
    const continueEp = custom.find((e) => e.apiKey === "custom_engage_continue");
    expect(continueEp?.content).toContain("Thank you for providing the project information");

    const front = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "front_yard",
        engageDesigner: true,
        dcName: "Brooke Edwards",
      },
      MOCK_QUESTIONNAIRES
    );
    const frontGoals = front.find((e) => e.apiKey === "project_goals_or_brief_description");
    expect(frontGoals?.card?.description).not.toContain("Brooke Edwards");
  });

  it("counts revision rounds keyed by the flow's revision apiKey", () => {
    const ids = [
      { id: "ep-architecture_changes" },
      { id: "ep-architecture_changes-summary" },
      { id: "ep-architecture_changes-2" },
    ] as Pick<Message, "id">[];
    expect(countRevisionRounds(ids, "architecture_changes")).toBe(2);
  });

  it("derives a question-level checklist for AllQuestion flows (null for legacy)", () => {
    const checklist = checklistFromFlowContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    expect(checklist?.length).toBeGreaterThan(0);
    expect(checklist?.every((c) => typeof c.id === "string" && typeof c.label === "string")).toBe(true);
    const ids = checklist?.map((c) => c.id) ?? [];
    expect(ids).toContain("additional_images_upload");
    expect(ids).toContain("project_goals_or_brief_description");
    expect(ids).not.toContain("phase_1");

    const addImagesItem = checklist?.find((c) => c.id === "additional_images_upload");
    expect(addImagesItem?.label).toBe("Additional House Photos"); // q.name when present

    // Test label formatting when q.name is absent
    const mockNoName = {
      ...MOCK_QUESTIONNAIRES,
      enterprise: {
        ...MOCK_QUESTIONNAIRES.enterprise,
        "color-material": {
          ...MOCK_QUESTIONNAIRES.enterprise["color-material"],
          color_material: {
            ...MOCK_QUESTIONNAIRES.enterprise["color-material"].color_material,
            phase_1: {
              ...MOCK_QUESTIONNAIRES.enterprise["color-material"].color_material.phase_1,
              questions: [
                { id: "additional_images_upload", type: "file" },
              ],
            },
          },
        },
      },
    };
    const checklistNoName = checklistFromFlowContext(ENTERPRISE_CM, mockNoName);
    expect(checklistNoName?.[0].label).toBe("Additional images upload");

    expect(checklistFromFlowContext({ role: "homeowner" })).toBeNull();
  });

  it("formats question IDs as human-readable names when name is absent", () => {
    expect(formatQuestionIdAsName("additional_images_upload")).toBe("Additional images upload");
    expect(formatQuestionIdAsName("supporting_files_upload")).toBe("Supporting files upload");
    expect(formatQuestionIdAsName("project_goals_or_brief_description")).toBe("Project goals or brief description");
    expect(formatQuestionIdAsName("")).toBe("");
  });

  it("restores a partial AllQuestion transcript with overview and resumes at the next card", () => {
    const eps = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    const t = buildRestoredTranscript(
      { project_goals_or_brief_description: item("repaint the front") },
      [],
      eps
    );
    const ids = t.messages.map((m) => m.id);
    expect(ids).toContain("ep-overview");
    expect(ids).toContain("ep-project_goals_or_brief_description");
    expect(t.currentId).toBe("exterior_color_and_material_style");
  });

  it("starts the AllQuestion flow with the overview episode", () => {
    const eps = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    expect(eps[0].apiKey).toBe("overview");
    expect(eps[0].showChecklist).toBe(true);
    expect(eps[0].options).toEqual(["I am ready to proceed  →"]);
  });

  it("assigns per-question checklistIds so each question tracks individually", () => {
    const eps = buildEpisodesFromContext(ENTERPRISE_CM, MOCK_QUESTIONNAIRES);
    const intakeEps = eps.filter((e) => e.api && !e.revisionStep);
    for (const ep of intakeEps) {
      expect(ep.checklistId).toBe(ep.apiKey);
    }
  });

  it("syncs upload gate checklistId with the target card on yard flows", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "front_yard",
        question_sets: { original: ["phase_1"], revision: ["phase_4"] },
      },
      MOCK_QUESTIONNAIRES
    );
    const photosGate = eps.find((e) => e.apiKey === "photos");
    const filesGate = eps.find((e) => e.apiKey === "files");
    const photosCard = eps.find((e) => e.apiKey === "additional_images_upload");
    const filesCard = eps.find((e) => e.apiKey === "supporting_files_upload");
    expect(photosGate?.checklistId).toBe(photosCard?.checklistId);
    expect(filesGate?.checklistId).toBe(filesCard?.checklistId);
  });

  it("produces a question-level checklist with correct labels from AllQuestion.json", () => {
    const eps = buildEpisodesFromContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "front_yard",
        question_sets: { original: ["phase_1"], revision: ["phase_4"] },
      },
      MOCK_QUESTIONNAIRES
    );
    const checklist = checklistFromFlowContext(
      {
        role: "enterprise",
        user_type: "landscape-design",
        work_type: "front_yard",
        question_sets: { original: ["phase_1"], revision: ["phase_4"] },
      },
      MOCK_QUESTIONNAIRES
    );
    expect(checklist).not.toBeNull();
    const numbers = checklist?.map((c) => c.number) ?? [];
    expect(numbers).toEqual(checklist?.map((_, i) => i + 1));
    const ids = checklist?.map((c) => c.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
