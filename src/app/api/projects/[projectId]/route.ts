import {
  isSupabaseServerConfigured,
  supabaseAdmin,
} from "../../../../lib/supabaseAdmin";
import type { LunaMyDesignProject } from "../../../../store/persistence/persistenceType";

export const runtime = "nodejs";

const TABLE = "luna_my_design_projects";

/**
 * GET /api/projects/{projectId} — return the project row (or `project: null`
 * when absent) so the chat can hydrate on refresh. DELETE removes the row
 * (Start Over / fresh intake).
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]">
) {
  const { projectId } = await ctx.params;

  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return Response.json(
      { error: "Supabase server-side is not configured" },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("project_id, chats, design_data, created_at, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ project: (data as LunaMyDesignProject | null) ?? null });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]">
) {
  const { projectId } = await ctx.params;

  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return Response.json(
      { error: "Supabase server-side is not configured" },
      { status: 500 }
    );
  }

  const { error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("project_id", projectId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, project_id: projectId });
}
