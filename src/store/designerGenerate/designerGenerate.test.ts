import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import designerGenerateReducer, {
  resetDesignerGenerate,
  selectDesignerError,
  selectDesignerLastHttpStatus,
  selectDesignerLifecycle,
  selectDesignerTaskByVersionId,
  selectLatestDesignerResult,
} from "./designerGenerateSlice";
import {
  DESIGNER_GENERATE_ENDPOINT,
  DESIGNER_TASK_STATUS_BASE,
  generateAndPollDesignerDesign,
} from "./designerGenerateThunk";
import type {
  DesignerGeneratePayload,
  DesignerGenerateResult,
} from "./designerGenerateType";

function createTestStore() {
  return configureStore({
    reducer: {
      designerGenerate: designerGenerateReducer,
    },
  });
}

const SAMPLE_PAYLOAD: DesignerGeneratePayload = {
  original_image_url: "https://mydesigns.pro/tmp/f1_1794676329.jpeg",
  prompt:
    "Create an elegant, photorealistic front yard landscape for this blue Craftsman home.",
  design_direction: "Elegant & timeless",
  image_style: "Photorealistic",
  preserve_original: false,
  reference_files: [],
  s3_upload_dir: "liv/dev/local/projects/138719/12232/luna",
  extra: {
    project_id: "138719",
    view_id: 12232,
  },
};

const SAMPLE_RESULT: DesignerGenerateResult = {
  task_id: "6be60202cb784fbf8fb1a7ad2d477746",
  original_image_url: "https://mydesigns.pro/tmp/f1_1794676329.jpeg",
  preserve_original: false,
  pipeline: "source_revision_edit_v2",
  model: "gpt-image-2",
  prompt: "Prompt text",
  brief_used: SAMPLE_PAYLOAD.prompt,
  brief_conflicts: [],
  house_facts: {
    architecture_style: "Two-story traditional home",
    wall_materials_and_colors: "Horizontal lap siding",
    trim_colors: "Dark taupe/brown trim",
    roof: "Dark gray asphalt shingle roof",
    entry_and_garage_door_colors: "Front entry door dark brown",
    railings: "Front porch wood railings",
    other_fixed_elements: "Covered front porch",
  },
  authorized_components: [],
  pallets: [
    {
      id: "pallet-1",
      name: "Exterior siding",
      category: "siding",
      category_source: "detected",
      source: "detected",
      change_type: "modified",
      status: "modified",
      image: "https://dzinlyv2.s3.us-east-2.amazonaws.com/pallet-1.png",
      before_image: null,
      details: "Blue shingle-style siding",
      color: "blue",
      color_name: "Charcoal Gray",
      color_hex: "#535C62",
      color_hex_source: "measured",
      texture: null,
      application: null,
      style: "painted shingle siding",
      brand: null,
      brand_source: null,
      quantity: 1,
      region: "whole house facade",
      before: { description: "weathered beige horizontal lap siding", color: "beige gray" },
      bbox: [0.1, 0.18, 0.88, 0.58],
      applied: true,
      confidence: 0.97,
      evidence: "Facade changed to blue shingle cladding.",
      unauthorized: false,
    },
  ],
  pallets_total: 1,
  pallets_applied_count: 1,
  pallets_warning: null,
  preservation_warnings: [],
  unauthorized_changes: [],
  changes_summary: {
    by_category: { siding: 1 },
    plant_count: 0,
    house_changes: ["Exterior siding"],
  },
  generated_image_url:
    "https://dzinlyv2.s3.us-east-2.amazonaws.com/liv/dev/local/projects/138719/12232/luna/6be60202cb784fbf8fb1a7ad2d477746/6be60202cb784fbf8fb1a7ad2d477746.png",
};

describe("designerGenerate slice & thunks", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits designer-generate, polls /api/v1/tasks/{task_id} while processing, and stores completed result", async () => {
    fetchMock
      // 1. Initial POST -> processing
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "processing",
            result: { task_id: SAMPLE_RESULT.task_id },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      // 2. First GET poll -> still processing
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "processing",
            result: null,
            error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      // 3. Second GET poll -> completed
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "completed",
            result: SAMPLE_RESULT,
            error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const store = createTestStore();
    const action = await store.dispatch(
      generateAndPollDesignerDesign({
        versionId: "live-1",
        payload: SAMPLE_PAYLOAD,
        pollIntervalMs: 1,
      })
    );

    expect(generateAndPollDesignerDesign.fulfilled.match(action)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Verify POST URL & body
    expect(fetchMock.mock.calls[0][0]).toBe(DESIGNER_GENERATE_ENDPOINT);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(SAMPLE_PAYLOAD);

    // Verify GET polling URL
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${DESIGNER_TASK_STATUS_BASE}/${SAMPLE_RESULT.task_id}`
    );
    expect(fetchMock.mock.calls[2][0]).toBe(
      `${DESIGNER_TASK_STATUS_BASE}/${SAMPLE_RESULT.task_id}`
    );

    const state = store.getState();
    expect(selectDesignerLifecycle(state)).toBe("completed");
    expect(selectDesignerError(state)).toBeNull();
    expect(selectDesignerLastHttpStatus(state)).toBe(200);
    expect(selectLatestDesignerResult(state)?.generated_image_url).toBe(
      SAMPLE_RESULT.generated_image_url
    );
    expect(selectLatestDesignerResult(state)?.pallets).toHaveLength(1);
    expect(selectLatestDesignerResult(state)?.changes_summary?.house_changes).toEqual([
      "Exterior siding",
    ]);

    const task = selectDesignerTaskByVersionId("live-1")(state);
    expect(task?.taskId).toBe(SAMPLE_RESULT.task_id);
    expect(task?.status).toBe("completed");
    expect(task?.pollCount).toBe(2);

    // Verify reset clears state
    store.dispatch(resetDesignerGenerate());
    expect(selectDesignerLifecycle(store.getState())).toBe("idle");
    expect(selectLatestDesignerResult(store.getState())).toBeNull();
  });

  it("handles failed task status during polling", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "processing",
            result: { task_id: "task-fail-1" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "failed",
            result: null,
            error: "Upstream model error",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const store = createTestStore();
    const action = await store.dispatch(
      generateAndPollDesignerDesign({
        versionId: "live-fail",
        payload: SAMPLE_PAYLOAD,
        pollIntervalMs: 1,
      })
    );

    expect(generateAndPollDesignerDesign.rejected.match(action)).toBe(true);
    const state = store.getState();
    expect(selectDesignerLifecycle(state)).toBe("failed");
    expect(selectDesignerError(state)).toBe("Upstream model error");
    expect(selectDesignerTaskByVersionId("live-fail")(state)?.status).toBe("failed");
  });

  it("handles HTTP error from POST /api/v1/luna/designer-generate", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Invalid image URL" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );

    const store = createTestStore();
    const action = await store.dispatch(
      generateAndPollDesignerDesign({
        versionId: "live-422",
        payload: SAMPLE_PAYLOAD,
        pollIntervalMs: 1,
      })
    );

    expect(generateAndPollDesignerDesign.rejected.match(action)).toBe(true);
    const state = store.getState();
    expect(selectDesignerLifecycle(state)).toBe("failed");
    expect(selectDesignerLastHttpStatus(state)).toBe(422);
    expect(selectDesignerError(state)).toBe("Invalid image URL");
  });
});
