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
import { validateAudioFile } from '../utils/audioValidation.js';
import { validateCoverArt } from '../utils/imageValidation.js';
import { parseUploadKey, localUploadPath } from '../utils/fileAccess.js';
import { deleteObject } from '../services/minioStorageService.js';

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
async function storeUploadedFile(localPath, fileKey, mimetype, originalFilename, userId) {
  const storedInMinio = await uploadToMinioAndCleanupLocal(localPath, fileKey, mimetype);
  const driveResult = storedInMinio ? null : await uploadToDriveAndCleanupLocal(localPath, originalFilename, mimetype);
  await prisma.storedUpload.create({ data: { key: driveResult?.key || fileKey, userId } });
  return driveResult || null;
}

// ===========================================
// STORAGE CONFIGURATION
// ===========================================

// Ensure upload directories exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const audioDir = path.join(uploadDir, 'audio');
const imagesDir = path.join(uploadDir, 'images');
const documentsDir = path.join(uploadDir, 'documents');

[uploadDir, audioDir, imagesDir, documentsDir].forEach(dir => {
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
// Only lossless formats accepted at all - MP3/M4A are rejected at the
// extension/mimetype filter here (cheap, before the file even lands on
// disk); WAV/FLAC still go through validateAudioFile() below for the real
// bit-depth/sample-rate inspection, since the extension alone doesn't prove
// those specs.
const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
];
const ALLOWED_AUDIO_EXTENSIONS = ['.wav', '.flac'];

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

function makeFileFilter(allowedMimeTypes, allowedExtensions, label) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no válido. Solo se aceptan archivos de ${label}.`), false);
    }
  };
}

const audioFileFilter = makeFileFilter(ALLOWED_AUDIO_MIME_TYPES, ALLOWED_AUDIO_EXTENSIONS, 'audio sin pérdida (WAV o FLAC)');
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

// KYC identity document (Onboarding, Grupo 1.1). Own storage/filter since
// it accepts PDF in addition to JPG/PNG, unlike the image filter above.
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, documentsDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const ALLOWED_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const ALLOWED_DOCUMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: makeFileFilter(ALLOWED_DOCUMENT_MIME_TYPES, ALLOWED_DOCUMENT_EXTENSIONS, 'identificación (JPG, PNG o PDF)'),
  limits: { fileSize: 10 * 1024 * 1024 },
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

  // Real technical inspection (bit depth, sample rate, lossless container) -
  // the extension/mimetype filter above only proves the file CLAIMS to be
  // WAV/FLAC. Rejected outright with a clear message; never transcoded
  // server-side (see audioValidation.js).
  const audioCheck = await validateAudioFile(req.file.path, req.file.originalname);
  if (!audioCheck.valid) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      error: 'Bad Request',
      message: audioCheck.message,
    });
  }

  const { releaseId, trackNumber } = req.body;

  // Generate file key/path (local fallback; overwritten below if the file
  // makes it to Google Drive via n8n)
  let fileKey = `audio/${req.file.filename}`;
  let fileUrl = `${getBaseUrl(req)}/uploads/${fileKey}`;

  const override = await storeUploadedFile(req.file.path, fileKey, req.file.mimetype, req.file.originalname, req.user.id);
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
          audioBitrate: audioCheck.meta.bitrateKbps,
          audioSampleRate: audioCheck.meta.sampleRate,
          durationMs: audioCheck.meta.durationMs,
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
  res.status(201).json({
    url: fileUrl,
    key: fileKey,
    durationMs: audioCheck.meta.durationMs,
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

  // Validate every file BEFORE storing any of them - a batch upload where
  // track 3 of 8 fails specs shouldn't leave 1-2 already moved to MinIO/Drive
  // while the caller thinks the whole batch failed.
  for (const file of req.files) {
    const check = await validateAudioFile(file.path, file.originalname);
    if (!check.valid) {
      await Promise.all(req.files.map((f) => new Promise((resolve) => fs.unlink(f.path, () => resolve()))));
      return res.status(400).json({ error: 'Bad Request', message: check.message });
    }
  }

  // Sequential (not Promise.all) so a slow/failed Drive upload for one file
  // can't race with another file's `unlink` of a similarly-named temp path,
  // and so n8n isn't hit with up to 30 concurrent large uploads at once.
  const files = [];
  for (const file of req.files) {
    let key = `audio/${file.filename}`;
    let url = `${baseUrl}/uploads/audio/${file.filename}`;

    const override = await storeUploadedFile(file.path, key, file.mimetype, file.originalname, req.user.id);
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

  // Real dimension/aspect-ratio check - cover art specifically (avatars
  // below go through uploadImage too but aren't held to the DSP 1:1/3000px
  // artwork spec).
  const coverCheck = validateCoverArt(req.file.path, req.file.originalname);
  if (!coverCheck.valid) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      error: 'Bad Request',
      message: coverCheck.message,
    });
  }

  const { releaseId } = req.body;

  let fileKey = `images/${req.file.filename}`;
  let fileUrl = `${getBaseUrl(req)}/uploads/${fileKey}`;

  const override = await storeUploadedFile(req.file.path, fileKey, req.file.mimetype, req.file.originalname, req.user.id);
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

  const override = await storeUploadedFile(req.file.path, fileKey, req.file.mimetype, req.file.originalname, req.user.id);
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

// Upload KYC identity document (Onboarding, Grupo 1.1)
router.post('/id-document', authenticate, uploadDocument.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No se recibió ningún archivo.',
    });
  }

  let fileKey = `documents/${req.file.filename}`;
  let fileUrl = `${getBaseUrl(req)}/uploads/${fileKey}`;

  const override = await storeUploadedFile(req.file.path, fileKey, req.file.mimetype, req.file.originalname, req.user.id);
  if (override) {
    fileUrl = override.url;
    fileKey = override.key;
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { idDocumentUrl: fileUrl, idDocumentKey: fileKey },
  });

  res.status(201).json({
    url: fileUrl,
    key: fileKey,
    success: true,
    message: 'Documento de identidad subido correctamente',
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

  if (!parseUploadKey(`${type}/${filename}`)) return res.sendStatus(400);

  if (!['audio', 'images'].includes(type)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid file type',
    });
  }

  const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
  const uploaded = await prisma.storedUpload.findUnique({ where: { key: `${type}/${filename}` } });
  if (!isPrivileged && uploaded?.userId !== req.user.id) {
    return res.status(403).json({ error: 'You do not own this upload' });
  }

  const filePath = await localUploadPath(uploadDir, `${type}/${filename}`);
  const removedRemote = await deleteObject(`${type}/${filename}`);

  // Check if file exists
  if (!filePath && !removedRemote) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'File not found',
    });
  }

  // Delete file
  if (filePath) fs.unlinkSync(filePath);

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

  if (err.message.includes('Tipo de archivo no válido')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message,
    });
  }

  next(err);
});

export default router;
