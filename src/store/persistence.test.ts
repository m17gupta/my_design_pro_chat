import { describe, expect, it } from "vitest";
import { payloadFromState } from "./index";
import briefReducer, { setOriginal, stateFromPayload } from "./briefSlice";
import type { ApiBriefPayload } from "../lib/apiBrief";

/** The exact shape the persistence middleware saves / hydrate restores. */
const SAVED: ApiBriefPayload = {
  projectId: "42",
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

    expect(restored.projectId).toBe("42");
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
    expect(state.id).toBe("42");
    expect(state.work_type).toBe("front_yard");
  });

  it("setOriginal updates original answered items without modifying context", () => {
    const initialState = {
      id: 406,
      work_type: "front_yard" as const,
      watermark: "https://mydesigns.pro/img/luna-logo.png",
      image_url: "https://www.mydesigns.pro/tmp/jenny.png",
      value: "color-material",
      user_type: "landscape-design",
      dc_name: "Brooke Edwards",
      role: "enterprise",
      custom_engage_designer: false,
      original: {},
      revision_comment: { files: [], notes: "" },
      question_sets: null,
    };

    const newOriginal = SAVED.original;
    const newState = briefReducer(initialState, setOriginal(newOriginal));

    expect(newState.original).toEqual(newOriginal);
    expect(newState.work_type).toBe("front_yard");
    expect(newState.dc_name).toBe("Brooke Edwards");
    expect(newState.id).toBe(406);
  });

  it("stateFromPayload preserves additional_images_upload and supporting_files_upload when answer is empty array", () => {
    const state = stateFromPayload({
      ...SAVED,
      original: {
        additional_images_upload: {
          name: "Additional House Photos (Optional)",
          question: "<p>Photos</p>",
          answer: [],
        },
        supporting_files_upload: {
          name: "Supporting Files Upload (Optional)",
          question: "<p>Files</p>",
          answer: [],
        },
      },
    });

    expect(state.original.additional_images_upload).toBeDefined();
    expect(state.original.additional_images_upload.answer).toEqual([]);
    expect(state.original.supporting_files_upload).toBeDefined();
    expect(state.original.supporting_files_upload.answer).toEqual([]);
  });

  it("preserves project_address through stateFromPayload and payloadFromState", () => {
    const address = {
      address: "mohan nagar jaipur",
      city: "jaipur",
      state: "Rajasthan",
      zip_code: "20802",
    };
    const state = stateFromPayload({
      ...SAVED,
      project_address: address,
    });
    expect(state.project_address).toEqual(address);

    const payload = payloadFromState(state);
    expect(payload.project_address).toEqual(address);
  });
});
