import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseUploadKey, localUploadPath, canReadUpload, requireOwnedUpload } from './fileAccess.js';

describe('upload boundaries', () => {
  it('accepts a single filename in a known storage category', () => {
    expect(parseUploadKey('audio/sample.wav')).toEqual({ type: 'audio', filename: 'sample.wav' });
    for (const key of ['unknown/file', 'images/a/b', 'images/..', 'images/a\\b', 'images/%2f', 'images/']) {
      expect(parseUploadKey(key)).toBeNull();
    }
  });
  it('serves regular files but refuses symlinks outside the root', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'upload-unit-'));
    try {
      await mkdir(path.join(root, 'uploads/images'), { recursive: true });
      await writeFile(path.join(root, 'uploads/images/cover.png'), 'synthetic');
      await writeFile(path.join(root, 'outside.txt'), 'synthetic');
      await symlink(path.join(root, 'outside.txt'), path.join(root, 'uploads/images/link.png'));
      expect(await localUploadPath(path.join(root, 'uploads'), 'images/cover.png')).toBeTruthy();
      expect(await localUploadPath(path.join(root, 'uploads'), 'images/link.png')).toBeNull();
      expect(await localUploadPath(path.join(root, 'uploads'), 'images/missing.png')).toBeNull();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('keeps KYC private to the owner or owner-level administrator', async () => {
    const db = { storedUpload: { findUnique: async () => ({ userId: 'owner' }) }, user: { findFirst: async ({ where }) => where.id === 'owner' ? { id: 'owner' } : null } };
    expect(await canReadUpload(db, { id: 'other', role: 'ARTIST' }, 'documents/id.pdf')).toBe(false);
    expect(await canReadUpload(db, { id: 'owner', role: 'ARTIST' }, 'documents/id.pdf')).toBe(true);
    expect(await canReadUpload(db, { id: 'reviewer', role: 'REVIEWER' }, 'documents/id.pdf')).toBe(false);
    expect(await canReadUpload(db, { id: 'admin', role: 'SUPER_ADMIN' }, 'documents/id.pdf')).toBe(true);
  });
  it('requires ownership or media permission for audio', async () => {
    const db = { storedUpload: { findUnique: async () => ({ userId: 'owner' }) }, track: { findFirst: async ({ where }) => where.release.userId === 'owner' ? { id: 't' } : null } };
    expect(await canReadUpload(db, { id: 'other', role: 'ARTIST' }, 'audio/sample.wav')).toBe(false);
    expect(await canReadUpload(db, { id: 'owner', role: 'ARTIST' }, 'audio/sample.wav')).toBe(true);
    expect(await canReadUpload(db, { id: 'reviewer', role: 'REVIEWER' }, 'audio/sample.wav')).toBe(true);
  });
  it('lets the uploader preview an unattached master and rejects attaching another user asset', async () => {
    const db = { storedUpload: { findUnique: async () => ({ userId: 'owner' }) } };
    expect(await canReadUpload(db, { id: 'owner', role: 'ARTIST' }, 'audio/sample.wav')).toBe(true);
    expect(await canReadUpload(db, { id: 'other', role: 'ARTIST' }, 'audio/sample.wav')).toBe(false);
    await expect(requireOwnedUpload(db, 'other', 'audio/sample.wav', 'audio')).rejects.toMatchObject({ statusCode: 403 });
    await expect(requireOwnedUpload(db, 'owner', 'audio/sample.wav', 'audio')).resolves.toBeUndefined();
  });
});
