import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uploadToDriveAndCleanupLocal } from '../services/n8nFileService.js';
import { uploadAndCleanupLocal as uploadToMinioAndCleanupLocal } from '../services/minioStorageService.js';

const router = Router();

// Prefer the explicit API_URL (documented in server/.env.example) so the URL
// is stable regardless of what host/port the request came in on; fall back to
// deriving it from the request itself (correct as long as `trust proxy` is set)
// instead of a hardcoded localhost that's always wrong once deployed.
const getBaseUrl = (req) => process.env.API_URL || `${req.protocol}://${req.get('host')}`;

// Storage chain: MinIO (self-hosted, same box, primary) -> Google Drive via
// n8n (fallback if MinIO is down/unconfigured) -> local disk (final
// fallback, today's original behavior). MinIO keeps the exact same
// `audio/<uuid>.ext` / `images/<uuid>.ext` key the local-disk path always
// used - GET /uploads/:type/:filename (src/index.js) transparently checks
// MinIO before local disk, so the public URL never needs to change for it.
// Drive is the one case that needs a different, external URL, hence the
// {url,key} override return value.
async function storeUploadedFile(localPath, fileKey, mimetype, originalFilename) {
  const storedInMinio = await uploadToMinioAndCleanupLocal(localPath, fileKey, mimetype);
  if (storedInMinio) return null;

  const driveResult = await uploadToDriveAndCleanupLocal(localPath, originalFilename, mimetype);
  if (driveResult) return driveResult;

  return null; // both remote options failed/unconfigured - local file stays put
}

// ===========================================
// STORAGE CONFIGURATION
// ===========================================

// Ensure upload directories exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const audioDir = path.join(uploadDir, 'audio');
const imagesDir = path.join(uploadDir, 'images');

[uploadDir, audioDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isAudio = file.mimetype.startsWith('audio/');
    cb(null, isAudio ? audioDir : imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  },
});

// File filters
//
// Two separate filters (audio-only, image-only) rather than one filter that
// accepts "audio OR image" - the previous single shared `fileFilter` meant
// the /upload/audio endpoint (using `uploadAudio`) would happily accept a
// PNG/JPEG too, since it only checked "is this mimetype audio-ish OR
// image-ish", not "is this the right kind of file for this endpoint". Each
// filter also cross-checks the file extension against the claimed mimetype
// as a cheap defense-in-depth measure against mimetype spoofing (the
// Content-Type on a multipart part is client-supplied and not trustworthy on
// its own).
const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
];
const ALLOWED_AUDIO_EXTENSIONS = ['.wav', '.flac', '.mp3', '.mp4', '.m4a'];

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

function makeFileFilter(allowedMimeTypes, allowedExtensions, label) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${label} files are allowed.`), false);
    }
  };
}

const audioFileFilter = makeFileFilter(ALLOWED_AUDIO_MIME_TYPES, ALLOWED_AUDIO_EXTENSIONS, 'audio (WAV, FLAC, MP3, M4A)');
const imageFileFilter = makeFileFilter(ALLOWED_IMAGE_MIME_TYPES, ALLOWED_IMAGE_EXTENSIONS, 'image (JPG, PNG)');

// Multer instances
const uploadAudio = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default
  },
});

const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
  },
});

// ===========================================
// ROUTES
// ===========================================

// Upload audio track
router.post('/audio', authenticate, requireRole('ARTIST', 'LABEL', 'ADMIN', 'SUPER_ADMIN'), uploadAudio.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No audio file provided',
    });
  }

  const { releaseId, trackNumber } = req.body;

  // Generate file key/path (local fallback; overwritten below if the file
  // makes it to Google Drive via n8n)
  let fileKey = `audio/${req.file.filename}`;
  let fileUrl = `${getBaseUrl(req)}/uploads/${fileKey}`;

  const override = await storeUploadedFile(req.file.path, fileKey, req.file.mimetype, req.file.originalname);
  if (override) {
    fileUrl = override.url;
    fileKey = override.key;
  }

  // If releaseId and trackNumber provided, update the track
  if (releaseId && trackNumber) {
    const release = await prisma.release.findFirst({
      where: {
        id: releaseId,
        userId: req.user.id,
      },
    });

    if (release) {
      await prisma.track.updateMany({
        where: {
          releaseId,
          trackNumber: parseInt(trackNumber),
        },
        data: {
          audioKey: fileKey,
          audioUrl: fileUrl,
          audioFormat: path.extname(req.file.originalname).slice(1).toUpperCase(),
          status: 'READY',
        },
      });
    }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'AUDIO_UPLOADED',
      entityType: 'Track',
      newValues: {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
      ipAddress: req.ip,
    },
  });

  // Matches frontend's `api.upload<{url, key, durationMs}>('/upload/audio', ...)`
  // contract - fields flattened to the top level (no `file` wrapper).
  // `durationMs` is not computed server-side (no audio-probing library is a
  // dependency here) - left null; the track's real durationMs is populated
  // once processing/transcoding fills it in.
  res.status(201).json({
    url: fileUrl,
    key: fileKey,
    durationMs: null,
    success: true,
    message: 'Audio file uploaded successfully',
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
}));

// Upload multiple audio tracks
router.post('/audio/batch', authenticate, requireRole('ARTIST', 'LABEL', 'ADMIN', 'SUPER_ADMIN'), uploadAudio.array('files', 30), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No audio files provided',
    });
  }

  const baseUrl = getBaseUrl(req);

  // Sequential (not Promise.all) so a slow/failed Drive upload for one file
  // can't race with another file's `unlink` of a similarly-named temp path,
  // and so n8n isn't hit with up to 30 concurrent large uploads at once.
  const files = [];
  for (const file of req.files) {
    let key = `audio/${file.filename}`;
    let url = `${baseUrl}/uploads/audio/${file.filename}`;

    const override = await storeUploadedFile(file.path, key, file.mimetype, file.originalname);
    if (override) {
      url = override.url;
      key = override.key;
    }

    files.push({
      key,
      url,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    });
  }

  // Matches frontend's `api.uploadBatch<Array<{url,key,filename}>>('/upload/audio/batch', ...)`
  // contract - a bare array, not wrapped in a `{files}` object.
  res.status(201).json(files);
}));

// Upload cover art
router.post('/cover', authenticate, requireRole('ARTIST', 'LABEL', 'ADMIN', 'SUPER_ADMIN'), uploadImage.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No image file provided',
    });
  }

  const { releaseId } = req.body;

  let fileKey = `images/${req.file.filename}`;
  let fileUrl = `${getBaseUrl(req)}/uploads/${fileKey}`;

  const override = await storeUploadedFile(req.file.path, fileKey, req.file.mimetype, req.file.originalname);
  if (override) {
    fileUrl = override.url;
    fileKey = override.key;
  }

  // If releaseId provided, update the release
  if (releaseId) {
    const release = await prisma.release.findFirst({
      where: {
        id: releaseId,
        userId: req.user.id,
      },
    });

    if (release) {
      await prisma.release.update({
        where: { id: releaseId },
        data: {
          coverArtKey: fileKey,
          coverArtUrl: fileUrl,
        },
      });
    }
  }

  // Matches frontend's `api.upload<{url, key}>('/upload/cover', ...)` contract
  // - fields flattened to the top level (no `file` wrapper).
  res.status(201).json({
    url: fileUrl,
    key: fileKey,
    success: true,
    message: 'Cover art uploaded successfully',
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
}));

// Upload avatar
router.post('/avatar', authenticate, uploadImage.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No image file provided',
    });
  }

  let fileKey = `images/${req.file.filename}`;
  let fileUrl = `${getBaseUrl(req)}/uploads/${fileKey}`;

  const override = await storeUploadedFile(req.file.path, fileKey, req.file.mimetype, req.file.originalname);
  if (override) {
    fileUrl = override.url;
    fileKey = override.key;
  }

  // Update user avatar
  await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarUrl: fileUrl },
  });

  // Matches frontend's `api.upload<{url, key}>('/upload/avatar', file)`
  // contract - fields flattened to the top level (no `file` wrapper).
  res.status(201).json({
    url: fileUrl,
    key: fileKey,
    success: true,
    message: 'Avatar uploaded successfully',
  });
}));

// Delete file
// NOTE: only handles files still on local disk (`type/filename`). Files that
// were forwarded to Google Drive (key looks like `drive:<fileId>`, see
// uploadToDriveAndCleanupLocal) aren't reachable through this route's
// `:type/:filename` shape and won't be found here — deleting those requires
// a separate Drive-delete call (not built yet; today's ask was just getting
// uploads off this box's disk, not full lifecycle management).
router.delete('/:type/:filename', authenticate, asyncHandler(async (req, res) => {
  const { type, filename } = req.params;

  if (!['audio', 'images'].includes(type)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid file type',
    });
  }

  // Ownership check: previously any authenticated user could delete any
  // uploaded file by knowing/guessing its filename, since this route only
  // checked `authenticate` and never verified the file belonged to the
  // caller. Admins bypass this (they may need to clean up on takedowns/user
  // deletion); everyone else must own the resource the file is attached to
  // (their own track's audio, their own release's cover art, or their own
  // avatar).
  const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
  if (!isPrivileged) {
    const fileKey = `${type}/${filename}`;
    const [ownedTrack, ownedRelease] = await Promise.all([
      prisma.track.findFirst({ where: { audioKey: fileKey, release: { userId: req.user.id } } }),
      prisma.release.findFirst({ where: { coverArtKey: fileKey, userId: req.user.id } }),
    ]);
    const isOwnAvatar = typeof req.user.avatarUrl === 'string' && req.user.avatarUrl.endsWith(`/${fileKey}`);

    if (!ownedTrack && !ownedRelease && !isOwnAvatar) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this file',
      });
    }
  }

  const filePath = path.join(uploadDir, type, filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'File not found',
    });
  }

  // Delete file
  fs.unlinkSync(filePath);

  res.json({
    success: true,
    message: 'File deleted successfully',
  });
}));

// Get upload signed URL (for S3-like services - placeholder)
router.post('/presigned', authenticate, requireRole('ARTIST', 'LABEL', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const { filename, contentType, fileSize } = req.body;

  // In production, generate S3 presigned URL here
  // For now, return local upload endpoint
  const key = `${uuidv4()}${path.extname(filename)}`;
  const isAudio = contentType.startsWith('audio/');

  res.json({
    success: true,
    uploadUrl: `${getBaseUrl(req)}/api/upload/${isAudio ? 'audio' : 'cover'}`,
    key: `${isAudio ? 'audio' : 'images'}/${key}`,
    method: 'POST',
    fields: {
      'Content-Type': contentType,
    },
  });
}));

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'File size exceeds the maximum allowed limit',
      });
    }
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message,
    });
  }

  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message,
    });
  }

  next(err);
});

export default router;
