import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Cloudinary chunked uploads support up to 100MB. */
const MAX_BYTES = 100 * 1024 * 1024;
/** 20MB chunks. */
const CHUNK_SIZE = 20 * 1024 * 1024;

/**
 * Signed, chunked upload proxy. The client streams the raw file here and we
 * forward it to Cloudinary with the API secret — the secret never reaches
 * the browser. Chunked uploads handle files up to 100MB.
 *
 * NB: the SDK's `v2.uploader.upload_chunked_stream` takes (options, callback)
 * — the callback receives (err, result). (The v2 adapter reorders the args
 * before delegating to the v1 internals.)
 */
export async function POST(request: Request) {
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

  const filename =
    decodeURIComponent(request.headers.get("x-file-name") ?? "upload") || "upload";

  try {
    const result = await new Promise<{ url: string; publicId: string }>(
      (resolve, reject) => {
        const out = cloudinary.uploader.upload_chunked_stream(
          {
            resource_type: "auto",
            folder: "chat-uploads",
            use_filename: true,
            unique_filename: true,
            filename: filename.replace(/\.[^/.]+$/, ""),
            chunk_size: CHUNK_SIZE,
          },
          (err, res) => {
            if (err) {
              reject(
                new Error(String(err?.message ?? err ?? "Cloudinary upload failed"))
              );
              return;
            }
            if (!res?.secure_url || !res?.public_id) {
              reject(new Error("Cloudinary returned an incomplete response"));
              return;
            }
            resolve({ url: res.secure_url, publicId: res.public_id });
          }
        );

        // Reject instead of hanging if the client disconnects mid-upload.
        out.on("error", reject);
        Readable.fromWeb(request.body as never).pipe(out);
      }
    );

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
