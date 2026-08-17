import {
  isSupabaseServerConfigured,
  supabaseAdmin,
} from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

const TABLE = "luna_my_design_projects";

/**
 * POST /api/projects — upsert a project row (`project_id`, `chats`,
 * `design_data`, `updated_at`). Runs server-side with the service-role key so
 * the browser never touches Supabase directly. Mirrors the old localStorage
 * write: last write wins on `project_id`.
 */
export async function POST(request: Request) {
  if (!isSupabaseServerConfigured || !supabaseAdmin) {
    return Response.json(
      { error: "Supabase server-side is not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { project_id, chats, design_data } = body as {
    project_id?: unknown;
    chats?: unknown;
    design_data?: unknown;
  };

  if (typeof project_id !== "string" || project_id.trim() === "") {
    return Response.json({ error: "project_id is required" }, { status: 400 });
  }

  const updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from(TABLE)
    .upsert(
      {
        project_id,
        chats: chats ?? {},
        design_data: Array.isArray(design_data) ? design_data : [],
        updated_at,
      },
      { onConflict: "project_id" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, project_id });
}
