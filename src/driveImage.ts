const maxDownloadBytes = 20 * 1024 * 1024;
const timeoutMs = 15_000;
const maxRedirects = 5;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export class DriveImageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isDriveDownload(url: URL): boolean {
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    ((url.hostname === "drive.google.com" && url.pathname === "/uc") ||
      (url.hostname === "drive.usercontent.google.com" && url.pathname === "/download"));
}

export function parseDriveImageUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (isDriveDownload(url) && url.searchParams.get("id")) return url;
  } catch {
    // Report malformed URLs and unsupported download destinations uniformly.
  }
  throw new DriveImageError("imageUrl must be an HTTPS Google Drive direct download link with a file ID.", 400);
}

function unreadableImage(): DriveImageError {
  return new DriveImageError("Google Drive did not return image bytes. Use a direct download link to an image shared as Anyone with the link → Viewer.", 422);
}

function downloadTooLarge(): DriveImageError {
  return new DriveImageError("The Google Drive image exceeds the 20 MiB download limit.", 413);
}

export async function downloadDriveImage(initialUrl: URL): Promise<ArrayBuffer> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = initialUrl;
  try {
    for (let redirects = 0; ; redirects++) {
      const response = await fetch(url, { redirect: "manual", signal });
      if (redirectStatuses.has(response.status)) {
        const location = response.headers.get("Location");
        await response.body?.cancel();
        if (!location || redirects >= maxRedirects) throw unreadableImage();
        const next = new URL(location, url);
        if (!isDriveDownload(next)) throw unreadableImage();
        url = next;
        continue;
      }

      const contentType = response.headers.get("Content-Type") ?? "";
      if (!response.ok || !response.body || /^text\/|^application\/(?:json|xhtml\+xml)/i.test(contentType)) {
        await response.body?.cancel();
        throw unreadableImage();
      }
      if (Number(response.headers.get("Content-Length")) > maxDownloadBytes) {
        await response.body.cancel();
        throw downloadTooLarge();
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxDownloadBytes) {
            await reader.cancel();
            throw downloadTooLarge();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      if (!size) throw unreadableImage();
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes.buffer;
    }
  } catch (failure) {
    if (failure instanceof DriveImageError) throw failure;
    if (signal.aborted) throw new DriveImageError("The Google Drive image download timed out.", 504);
    throw new DriveImageError("Could not download the image from Google Drive.", 502);
  }
}
