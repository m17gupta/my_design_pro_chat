import { createAsyncThunk } from "@reduxjs/toolkit";
import type { ApiBriefPayload } from "../../lib/apiBrief";
import type { EnterpriseEntry } from "../enterprise/enterpriseType";
import { setBriefState, setContext, setOriginal, setRevision, stateFromPayload } from "../briefSlice";
import { setEntries } from "../enterprise/enterpriseSlice";
import type { LunaMyDesignProject } from "./persistenceType";

/**
 * Helper to handle fetch responses consistently within thunks
 */
async function fetchApi(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("Network error — could not reach the persistence API");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (e.g. HTML error page) — keep status-only failure.
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `API error (${res.status})`;
    throw new Error(message);
  }

  return data;
}

/**
 * All CRUD runs server-side through /api/projects.
 * The browser only ever talks to our own routes — Supabase keys stay in
 * environment variables on the server (src/lib/supabaseAdmin.ts).
 */

export const hydrateProject = createAsyncThunk<
  { projectId: string; row: LunaMyDesignProject | null },
  { projectId: string },
  { rejectValue: string }
>("persistence/hydrateProject", async ({ projectId }, { dispatch, getState, rejectWithValue }) => {
  try {
    const data = await fetchApi(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "GET",
      cache: "no-store",
    });

    const project = (data as { project?: LunaMyDesignProject } | null)?.project;
    if (project) {
      // Restore answered questions (original) and design history (design_data)
      // without overwriting top-level brief context.
      if (project.chats && typeof project.chats === "object") {
        const rootState = getState() as { questionnaires?: { data?: Record<string, unknown> | null } };
        const questionnaires = rootState.questionnaires?.data ?? null;
        const restored = stateFromPayload(project.chats, questionnaires);
        const originalData =
          restored.original && Object.keys(restored.original).length > 0
            ? restored.original
            : project.chats.original || {};
        dispatch(setOriginal(originalData));
        dispatch(setRevision(restored?.revision_comment));

        dispatch(
          setContext({
            id: project.chats.projectId,
            work_type: project.chats.work_type,
            user_type: project.chats.user_type,
            dc_name: project.chats.dc_name,
            role: project.chats.role,
            custom_engage_designer: project.chats.custom_engage_designer,
            watermark: project.chats.watermark,
            image_url: project.chats.image_url,
            value: project.chats.value,
            question_sets: project.chats.question_sets,
          })
        );
      }
      if (Array.isArray(project.design_data)) {
        dispatch(setEntries(project.design_data));
      }
    }
    return { projectId, row: project ?? null };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to restore project"
    );
  }
});


export const saveProject = createAsyncThunk<
  { projectId: string; savedAt: string },
  { projectId: string; chats: ApiBriefPayload; designData: EnterpriseEntry[] },
  { rejectValue: string }
>("persistence/saveProject", async ({ projectId, chats, designData }, { rejectWithValue }) => {
  try {
    await fetchApi("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, chats, design_data: designData }),
    });
    return { projectId, savedAt: new Date().toISOString() };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to save project"
    );
  }
});

/**
 * Delete the project row (e.g. on Start Over / fresh intake). Mirrors the old
 * `localStorage.removeItem` semantics so a reset genuinely starts from zero.
 */
export const deleteProject = createAsyncThunk<
  { projectId: string },
  { projectId: string },
  { rejectValue: string }
>("persistence/deleteProject", async ({ projectId }, { rejectWithValue }) => {
  try {
    await fetchApi(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
    return { projectId };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Failed to delete project"
    );
  }
});
