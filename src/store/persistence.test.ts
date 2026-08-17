import { describe, expect, it } from "vitest";
import { payloadFromState } from "./index";
import { stateFromPayload } from "./briefSlice";
import type { ApiBriefPayload } from "../lib/apiBrief";

/** The exact shape the persistence middleware saves / hydrate restores. */
const SAVED: ApiBriefPayload = {
  id: 42,
  watermark: "https://wm.example/logo.png",
  work_type: "front_yard",
  image_url: "https://img.example/home.jpg",
  value: "gold",
  revision_comment: {
    files: ["https://img.example/fix.jpg"],
    notes: "change the roof color",
  },
  original: {
    project_goals_or_brief_description: {
      name: "Project goals or brief description",
      question: "Tell me about your project",
      answer: "Modern front yard with native plants",
    },
  },
};

describe("persistence round-trip", () => {
  it("payloadFromState -> stateFromPayload preserves answered items + context", () => {
    const restored = payloadFromState(stateFromPayload(SAVED));

    expect(restored.id).toBe(42);
    expect(restored.work_type).toBe("front_yard");
    expect(restored.watermark).toBe(SAVED.watermark);
    expect(restored.revision_comment).toEqual(SAVED.revision_comment);
    // The answered question survives the round-trip unchanged.
    expect(restored.original.project_goals_or_brief_description).toEqual(
      SAVED.original.project_goals_or_brief_description
    );
  });

  it("stateFromPayload drops empty (unanswered) items so key presence = answered", () => {
    const state = stateFromPayload({
      ...SAVED,
      original: {
        project_goals_or_brief_description: {
          name: "n",
          question: "q",
          answer: "",
        },
      },
    });
    expect(state.original).toEqual({});
    // Context still restored.
    expect(state.id).toBe(42);
    expect(state.work_type).toBe("front_yard");
  });
});
