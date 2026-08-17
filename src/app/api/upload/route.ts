import { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export const runtime = "nodejs";

const BUCKET = process.env.AWS_BUCKET ?? "";
const REGION = process.env.AWS_DEFAULT_REGION ?? "";
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? "";
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

/** Keep the previous 100MB cap — S3 multipart supports far more, but the
 *  design-intake files are human-sized and this bound matches the old route. */
const MAX_BYTES = 100 * 1024 * 1024;

/**
 * Signed upload proxy. The client streams the raw file here and we put it in
 * the S3 bucket with the AWS secret — the secret never reaches the browser.
 * Returns the public object URL (bucket must allow public reads, or sit behind
 * CloudFront) plus the object key for reference.
 */
export async function POST(request: Request) {
  if (!BUCKET || !REGION || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    return Response.json(
      { error: "S3 upload is not configured (missing AWS_* env vars)" },
      { status: 500 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return Response.json(
      { error: `File size too large. Got ${contentLength} bytes. Maximum is ${MAX_BYTES} bytes.` },
      { status: 413 }
    );
  }

  if (!request.body) {
    return Response.json({ error: "Missing request body" }, { status: 400 });
  }

  const rawName =
    decodeURIComponent(request.headers.get("x-file-name") ?? "upload") || "upload";
  // Strip path separators and anything that isn't safe for an S3 key.
  const safeName = rawName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120);
  const key = `luna-ai/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;

  try {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: BUCKET,
        Key: key,
        Body: Readable.fromWeb(request.body as never),
        ContentLength: contentLength || undefined,
        ContentType:
          request.headers.get("content-type") || "application/octet-stream",
      },
    });

    await upload.done();

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    return Response.json({ url, key });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
