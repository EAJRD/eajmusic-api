import { readFile, unlink } from 'fs/promises';

// ===========================================
// FILE STORAGE VIA N8N -> GOOGLE DRIVE
// ===========================================
// The LXC this API runs on has very limited local disk (a few hundred MB
// free). Rather than accumulate uploaded audio/images on that disk, each
// upload is forwarded to an n8n webhook (n8n-workflows/file-upload-to-drive.json)
// that uploads it to Google Drive and responds synchronously with the
// resulting file's link/id. On success, the local temp copy multer wrote is
// deleted immediately. If n8n/Drive is unreachable or misconfigured, the
// local file is kept and served as before (see /uploads/:type/:filename in
// src/index.js) — an upload should never fail just because Drive is down.

const N8N_FILE_TIMEOUT_MS = 60000; // audio files can be tens of MB; give this more room than the 5s notification webhooks

/**
 * Uploads a locally-saved file to Google Drive via n8n, then deletes the
 * local copy on success. Returns null (never throws) if N8N_WEBHOOK_BASE_URL
 * isn't configured or the upload fails for any reason — callers should treat
 * a null return as "keep using the local file/URL".
 */
export async function uploadToDriveAndCleanupLocal(localPath, originalFilename, mimetype) {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) return null;

  try {
    const buffer = await readFile(localPath);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimetype }), originalFilename);

    const response = await fetch(`${base}/file-upload-to-drive`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(N8N_FILE_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[n8nFileService] Drive upload failed: HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    if (!result?.driveUrl || !result?.driveFileId) {
      console.error('[n8nFileService] Drive upload response missing driveUrl/driveFileId:', result);
      return null;
    }

    await unlink(localPath).catch((err) => {
      // Non-fatal: the file made it to Drive, a stray local copy just wastes
      // a little disk rather than breaking the upload.
      console.error(`[n8nFileService] Uploaded to Drive but failed to remove local temp file ${localPath}:`, err.message);
    });

    return {
      url: result.driveUrl,
      key: `drive:${result.driveFileId}`,
    };
  } catch (err) {
    console.error('[n8nFileService] Drive upload error, keeping local file:', err.message);
    return null;
  }
}
