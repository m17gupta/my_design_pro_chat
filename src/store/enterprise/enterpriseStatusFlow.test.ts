import { afterEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import reducer from "./enterpriseSlice";
import { fetchEnterpriseStatus, generateEnterpriseDesign } from "./enterpriseThunk";
import type { ApiBriefPayload } from "../../lib/apiBrief";

const samplePayload: ApiBriefPayload = {
  projectId: "992",
  role: "enterprise-client",
  user_type: "landscape-design",
  work_type: "front_yard",
  watermark: "",
  value: "",
  image_url: "https://example.com/input.jpg",
  original: {},
  revision_comment: { files: [], notes: "Sample notes" },
};

// Exact response structure provided by the user
const asyncInitialResponse = {
  status: "processsing",
  result: {
    task_id: "10f74952-23a1-4976-b63c-686abe44ccbb",
    original_image_url:
      "https://dzinlyv2.s3.us-east-2.amazonaws.com/luna-ai/vendor_images/992/design_1681300e-5580-4a07-bbaa-23dcaf956148.png",
    pipeline: "source_landscape_edit_v1",
    model: "gpt-image-2",
    work_type: "front_yard",
    reference_image_urls: [],
    vision_data: null,
    mask_stats: null,
    generated_image_url: null,
    watermark_status: "",
  },
  error: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function setupStore() {
  return configureStore({
    reducer: { enterprise: reducer },
  });
}

describe("Async Image Generation & Status Polling Flow", () => {
  it("correctly ingests initial task response with 'processsing' status and empty url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(asyncInitialResponse, { status: 200 })
      )
    );

    const store = setupStore();
    const entry = await store
      .dispatch(generateEnterpriseDesign({ payload: samplePayload }))
      .unwrap();

    expect(entry.id).toBe("10f74952-23a1-4976-b63c-686abe44ccbb");
    expect(entry.task_id).toBe("10f74952-23a1-4976-b63c-686abe44ccbb");
    expect(entry.status).toBe("processing"); // Normalized from "processsing"
    expect(entry.url).toBe("");
    expect(entry.generated_image_url).toBeNull();
    expect(entry.original_image_url).toBe(
      "https://dzinlyv2.s3.us-east-2.amazonaws.com/luna-ai/vendor_images/992/design_1681300e-5580-4a07-bbaa-23dcaf956148.png"
    );
    expect(entry.pipeline).toBe("source_landscape_edit_v1");

    const state = store.getState().enterprise;
    expect(state.lifecycle).toBe("pending");
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].status).toBe("processing");
  });

  it("updates entry url and lifecycle to succeeded when status endpoint returns completed", async () => {
    const store = setupStore();

    // 1. Initial generation returns processing task
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json(asyncInitialResponse, { status: 200 })
      )
    );
    await store.dispatch(generateEnterpriseDesign({ payload: samplePayload })).unwrap();

    // 2. Poll 1 returns still processing
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json(
          {
            status: "processing",
            result: {
              task_id: "10f74952-23a1-4976-b63c-686abe44ccbb",
              generated_image_url: null,
            },
            error: null,
          },
          { status: 200 }
        )
      )
    );
    await store.dispatch(fetchEnterpriseStatus("10f74952-23a1-4976-b63c-686abe44ccbb")).unwrap();

    let state = store.getState().enterprise;
    expect(state.entries[0].status).toBe("processing");
    expect(state.entries[0].url).toBe("");
    expect(state.lifecycle).toBe("pending");

    // 3. Poll 2 returns completed with generated image url
    const completedImageUrl =
      "https://dzinlyv2.s3.us-east-2.amazonaws.com/luna-ai/vendor_images/992/output_generated.png";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json(
          {
            status: "completed",
            result: {
              task_id: "10f74952-23a1-4976-b63c-686abe44ccbb",
              original_image_url: asyncInitialResponse.result.original_image_url,
              generated_image_url: completedImageUrl,
              pipeline: "source_landscape_edit_v1",
              model: "gpt-image-2",
              work_type: "front_yard",
            },
            error: null,
          },
          { status: 200 }
        )
      )
    );
    await store.dispatch(fetchEnterpriseStatus("10f74952-23a1-4976-b63c-686abe44ccbb")).unwrap();

    state = store.getState().enterprise;
    expect(state.entries[0].status).toBe("completed");
    expect(state.entries[0].url).toBe(completedImageUrl);
    expect(state.entries[0].generated_image_url).toBe(completedImageUrl);
    expect(state.lifecycle).toBe("succeeded");
    expect(state.error).toBeNull();
  });

  it("handles status failed correctly", async () => {
    const store = setupStore();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json(asyncInitialResponse, { status: 200 })
      )
    );
    await store.dispatch(generateEnterpriseDesign({ payload: samplePayload })).unwrap();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json(
          {
            status: "failed",
            result: null,
            error: "Image generation model timed out",
          },
          { status: 200 }
        )
      )
    );
    await store.dispatch(fetchEnterpriseStatus("10f74952-23a1-4976-b63c-686abe44ccbb")).unwrap();

    const state = store.getState().enterprise;
    expect(state.entries[0].status).toBe("failed");
    expect(state.lifecycle).toBe("failed");
    expect(state.error).toBe("Image generation model timed out");
  });
});
