import { createAsyncThunk } from "@reduxjs/toolkit";
import type { ApiBriefPayload } from "../../lib/apiBrief";
import type { EnterpriseEntry } from "../enterprise/enterpriseType";
import { setBriefState, stateFromPayload } from "../briefSlice";
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

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (e.g. HTML error page) — keep status-only failure.
  }

  if (!res.ok) {
    const message = data?.error || `API error (${res.status})`;
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
>("persistence/hydrateProject", async ({ projectId }, { dispatch, rejectWithValue }) => {
  try {
    const data = await fetchApi(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "GET",
      cache: "no-store",
    });

    const project = data?.project;
    console.log("hydrated project--->", project);

    if (project) {
      // Restore the brief payload (context + answered questions) and the
      // design history exactly as they were saved.
      if (project.chats && typeof project.chats === "object") {
        dispatch(setBriefState(stateFromPayload(project.chats)));
      }
      if (Array.isArray(project.design_data)) {
        dispatch(setEntries(project.design_data));
      }
    }
    return { projectId, row: project };
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

    console.log("calling save project", { project_id: projectId, chats, design_data: designData })
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
