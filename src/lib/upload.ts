export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload via the signed `/api/upload` route, which proxies to the AWS S3
 * bucket server-side (supports files up to 100MB). The AWS secret never
 * reaches the browser. Progress reflects the client→server leg (XHR, since
 * fetch has no reliable upload-progress support).
 */
export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let data: { url?: string; key?: string; error?: string };
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Invalid response from upload server"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        resolve({ url: data.url, key: data.key ?? "" });
      } else {
        reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
