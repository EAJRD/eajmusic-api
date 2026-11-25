import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { userHasPermission } from '../middleware/rbac.js';

export function parseUploadKey(key) {
  if (typeof key !== 'string') return null;
  const match = /^(audio|images|documents)\/([a-zA-Z0-9][a-zA-Z0-9_.-]*)$/.exec(key);
  return match ? { type: match[1], filename: match[2] } : null;
}

export async function localUploadPath(root, key) {
  if (!parseUploadKey(key)) return null;
  try {
    const base = await realpath(root);
    const target = await realpath(path.join(base, key));
    if (!target.startsWith(base + path.sep) || !(await stat(target)).isFile()) return null;
    return target;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return null;
    throw error;
  }
}

export async function canReadUpload(db, user, key) {
  const parsed = parseUploadKey(key);
  if (!parsed) return false;
  if (parsed.type === 'images') return true;
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || (parsed.type === 'audio' && userHasPermission(user, 'releases:media'))) return true;
  const uploaded = await db.storedUpload.findUnique({ where: { key } });
  return uploaded?.userId === user.id;
}

export async function requireOwnedUpload(db, userId, key, type) {
  if (key == null) return;
  if (parseUploadKey(key)?.type !== type && !/^drive:[a-zA-Z0-9_-]+$/.test(key)) {
    throw Object.assign(new Error('Invalid upload key'), { statusCode: 400 });
  }
  const uploaded = await db.storedUpload.findUnique({ where: { key } });
  if (!uploaded || uploaded.userId !== userId) {
    throw Object.assign(new Error('Upload does not belong to this account'), { statusCode: 403 });
  }
}
