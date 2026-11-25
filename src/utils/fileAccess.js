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
  if (parsed.type === 'documents') {
    if (user.role === 'SUPER_ADMIN') return true;
    return Boolean(await db.user.findFirst({ where: { id: user.id, idDocumentKey: key }, select: { id: true } }));
  }
  if (userHasPermission(user, 'releases:media')) return true;
  return Boolean(await db.track.findFirst({ where: { audioKey: key, release: { userId: user.id } }, select: { id: true } }));
}
