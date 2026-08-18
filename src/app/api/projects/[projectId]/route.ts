import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import {
  isSupabaseServerConfigured,
  supabaseAdmin,
} from "../../../../lib/supabaseAdmin";
import type { LunaMyDesignProject } from "../../../../store/persistence/persistenceType";

export const runtime = "nodejs";

const TABLE = "luna_my_design_projects";

const BUCKET = process.env.AWS_BUCKET ?? "";
const REGION = process.env.AWS_DEFAULT_REGION ?? "";
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? "";
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? "";

const isS3Configured = Boolean(
  BUCKET && REGION && ACCESS_KEY_ID && SECRET_ACCESS_KEY
);

const s3 = isS3Configured
  ? new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    })
  : null;

/**
 * Delete all S3 objects under `luna-ai/<projectId>/` prefix.
 */
async function deleteS3Folder(projectId: string) {
  if (!s3 || !BUCKET) return;

  const prefix = `luna-ai/${projectId}/`;
  let continuationToken: string | undefined;

  do {
    const listOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (listOutput.Contents && listOutput.Contents.length > 0) {
      const objectsToDelete = listOutput.Contents.map((obj) => ({
        Key: obj.Key,
      })).filter((obj): obj is { Key: string } => Boolean(obj.Key));

      if (objectsToDelete.length > 0) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
              Objects: objectsToDelete,
            },
          })
        );
      }
    }

    continuationToken = listOutput.NextContinuationToken;
  } while (continuationToken);
}

/**
 * GET /api/projects/{projectId} — return the project row (or `project: null`
 * when absent) so the chat can hydrate on refresh. DELETE removes the row
 * (Start Over / fresh intake) and deletes all files in the S3 folder (`luna-ai/<projectId>/`).
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

  try {
    await deleteS3Folder(projectId);
  } catch (s3Err) {
    console.error("Failed to delete S3 folder for project:", projectId, s3Err);
  }

  return Response.json({
    ok: true,
    project_id: projectId,
    message: "Both project and s3 bucket folder is deleted",
  });
}

