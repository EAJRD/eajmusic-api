import { Client } from 'minio';
import { unlink } from 'fs/promises';

// ===========================================
// PRIMARY FILE STORAGE: SELF-HOSTED MINIO
// ===========================================
// MinIO runs as a systemd service on this same box (127.0.0.1:9000, not
// exposed publicly — see /etc/systemd/system/minio.service), giving proper
// S3-style object storage on a disk that was sized for it, instead of
// piling uploads onto the small root filesystem. This is the PRIMARY
// storage path; Google Drive via n8n (n8nFileService.js) is the fallback if
// MinIO is unreachable, and local disk is the final fallback if both fail —
// an upload should never hard-fail because of either integration.
//
// Object keys intentionally match the same `audio/<uuid>.ext` /
// `images/<uuid>.ext` shape local files always used, so the public-facing
// URL a client sees never changes — only where GET /uploads/:type/:filename
// (src/index.js) actually reads the bytes from does.

const BUCKET = process.env.MINIO_BUCKET || 'eajmusic-uploads';

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ROOT_USER || !process.env.MINIO_ROOT_PASSWORD) {
    return null;
  }
  const url = new URL(process.env.MINIO_ENDPOINT);
  client = new Client({
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80),
    useSSL: url.protocol === 'https:',
    accessKey: process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_ROOT_PASSWORD,
  });
  return client;
}

/**
 * Uploads a locally-saved file into MinIO under `objectKey`, then deletes
 * the local copy on success. Returns true on success, false on any failure
 * (MinIO not configured, unreachable, etc.) — never throws. Callers should
 * fall back to the next storage option (Drive, then local) when this
 * returns false.
 */
export async function uploadAndCleanupLocal(localPath, objectKey, mimetype) {
  const minio = getClient();
  if (!minio) return false;

  try {
    await minio.fPutObject(BUCKET, objectKey, localPath, { 'Content-Type': mimetype });
    await unlink(localPath).catch((err) => {
      console.error(`[minioStorageService] Uploaded but failed to remove local temp file ${localPath}:`, err.message);
    });
    return true;
  } catch (err) {
    console.error(`[minioStorageService] Upload failed for ${objectKey}, falling back:`, err.message);
    return false;
  }
}

/**
 * Returns a readable stream for `objectKey`, or null if it doesn't exist in
 * MinIO (either genuinely absent, or MinIO isn't configured/reachable) —
 * callers should fall back to checking local disk in that case.
 */
export async function getObjectStream(objectKey) {
  const minio = getClient();
  if (!minio) return null;

  try {
    return await minio.getObject(BUCKET, objectKey);
  } catch (err) {
    if (err.code !== 'NoSuchKey' && err.code !== 'NotFound') {
      console.error(`[minioStorageService] getObject error for ${objectKey}:`, err.message);
    }
    return null;
  }
}

export async function deleteObject(objectKey) {
  const minio = getClient();
  if (!minio) return false;
  try {
    await minio.removeObject(BUCKET, objectKey);
    return true;
  } catch (err) {
    console.error(`[minioStorageService] delete failed for ${objectKey}:`, err.message);
    return false;
  }
}
