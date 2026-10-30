import { describe, expect, it, vi } from "vitest";
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

  it("prioritizes overrideImageUrl and active image_url over database image_url during hydration", async () => {
    const { configureStore } = await import("@reduxjs/toolkit");
    const { hydrateProject } = await import("./persistence/persistenceThunk");
    const { default: persistenceReducer } = await import("./persistence/persistenceSlice");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        project: {
          id: "42",
          chats: {
            ...SAVED,
            image_url: "https://db.example/old.jpg",
          },
          design_data: [],
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Case 1: overrideImageUrl provided -> should win over DB
    const store1 = configureStore({
      reducer: { chat: briefReducer, persistence: persistenceReducer },
    });
    await store1.dispatch(
      hydrateProject({
        projectId: "42",
        overrideImageUrl: "https://param.example/override.jpg",
      })
    );
    expect(store1.getState().chat.image_url).toBe("https://param.example/override.jpg");

    // Case 2: active image_url already in state -> should win over DB
    const store2 = configureStore({
      reducer: { chat: briefReducer, persistence: persistenceReducer },
      preloadedState: {
        chat: {
          ...briefReducer(undefined, { type: "@@INIT" }),
          image_url: "https://param.example/active.jpg",
        },
      },
    });
    await store2.dispatch(hydrateProject({ projectId: "42" }));
    expect(store2.getState().chat.image_url).toBe("https://param.example/active.jpg");

    // Case 3: no override and no active state -> DB fallback wins
    const store3 = configureStore({
      reducer: { chat: briefReducer, persistence: persistenceReducer },
    });
    await store3.dispatch(hydrateProject({ projectId: "42" }));
    expect(store3.getState().chat.image_url).toBe("https://db.example/old.jpg");

    vi.unstubAllGlobals();
  });

  it("preserves access_token through stateFromPayload and payloadFromState", () => {
    const state = stateFromPayload({
      ...SAVED,
      access_token: "test_access_token_123",
    });
    expect(state.access_token).toBe("test_access_token_123");

    const payload = payloadFromState(state);
    expect(payload.access_token).toBe("test_access_token_123");
  });
});

