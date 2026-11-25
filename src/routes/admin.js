import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requirePermission, userHasPermission } from '../middleware/rbac.js';
import {
  availableTransitions,
  validateTransition,
  isTerminalState,
  coarseStatusFor,
  workflowTypeForCategory,
  initialStateFor,
} from '../utils/ticketWorkflow.js';
import { applyEffect, WorkflowEffectError } from '../services/ticketWorkflowEffects.js';
import { validate } from '../validators/auth.js';
import { adminReviewSchema } from '../validators/release.js';
import { getObjectStream } from '../services/minioStorageService.js';
import {
  createEmployeeSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  updateSettingSchema,
} from '../validators/admin.js';
import { moderateTestimonialSchema } from '../validators/testimonial.js';
import { parseUploadKey, localUploadPath } from '../utils/fileAccess.js';
import { sendEmail, employeeInvitationEmailHtml, EMAIL_FROM } from '../services/emailService.js';

import { processPayout, importCompletedPayout, conflict } from "../services/payoutService.js";

const router = Router();

// Rewrites coverArtUrl to point at the admin-gated GET /releases/:id/cover
// endpoint below instead of the public /uploads/images/... path, so the
// admin panel doesn't itself advertise the raw object key/URL for
// DRAFT/PENDING covers. NOTE: this does not by itself make those objects
// unreachable - GET /uploads/:type/:filename (src/index.js) still serves
// all `images/*` keys unauthenticated by design (see the comment there).
// Real confidentiality for pre-LIVE covers would require gating that route
// too, which needs a per-request release-status lookup and is a separate,
// riskier change to a path that public pages (/talent, testimonials) rely on.
function withAdminCoverUrl(req, release) {
  if (!release || (!release.coverArtKey && !release.coverArtUrl)) return release;
  const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
  return { ...release, coverArtUrl: `${baseUrl}/api/admin/releases/${release.id}/cover` };
}

// All routes require authentication and at least one admin-panel role.
// Every route below layers a finer requirePermission()/requireRole(...)
// check on top of this baseline - this outer gate only keeps
// ARTIST/LABEL out, it does NOT imply full access for SUPPORT/REVIEWER/
// FINANCE. Each route must have its own explicit guard matching
// ROLE_PERMISSIONS (src/middleware/rbac.js), otherwise it defaults to
// "any of these 5 roles" which is almost never what's intended.
router.use(authenticate);
router.use(requireRole('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'REVIEWER', 'FINANCE'));

// ===========================================
// DASHBOARD STATS
// ===========================================
// Includes platform-wide revenue totals, so this is not open to every
// admin-panel role - dashboard:read is granted to ADMIN/FINANCE only
// (SUPER_ADMIN via '*'). SUPPORT and REVIEWER land on their own tab instead.
router.get('/stats', requirePermission('dashboard:read'), asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeReleases,
    pendingApprovals,
    totalRevenue,
    newUsersToday,
    pendingPayouts,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { in: ['ARTIST', 'LABEL'] } } }),
    prisma.release.count({ where: { status: 'LIVE' } }),
    prisma.release.count({ where: { status: 'PENDING' } }),
    prisma.royalty.aggregate({ _sum: { grossRevenue: true } }),
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        role: { in: ['ARTIST', 'LABEL'] },
      },
    }),
    prisma.payout.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
    }),
  ]);

  res.json({
    totalUsers,
    activeReleases,
    pendingApprovals,
    totalRevenue: totalRevenue._sum.grossRevenue || 0,
    newUsersToday,
    pendingPayouts: pendingPayouts._sum.amount || 0,
  });
}));

// ===========================================
// USERS MANAGEMENT
// ===========================================
router.get('/users', requirePermission('users:read'), asyncHandler(async (req, res) => {
  const { role, status, search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

  const where = {
    ...(role && { role }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
        subscription: {
          select: { plan: true, commissionRate: true, isActive: true, expiresAt: true },
        },
        _count: {
          select: { releases: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.user.count({ where }),
  ]);

  // Matches frontend's PaginatedResponse<T> = {data, total, page, limit, totalPages}
  res.json({
    data: users,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 0,
  });
}));

// ===========================================
// CREATE EMPLOYEE ACCOUNT (Super Admin only)
// ===========================================
router.post('/users', requireRole('SUPER_ADMIN'), validate(createEmployeeSchema), asyncHandler(async (req, res) => {
  const { email, name, role, permissions } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingUser) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'An account with this email already exists',
    });
  }

  // Same pattern as label-invited artists / sync-insforge-user's own
  // auto-provisioning: no admin-supplied or generated password. InsForge
  // (the credential front door - see AGENTS.md) always requires the account
  // holder to choose their own password via signUp(), so there's nothing
  // useful to hand the Super Admin here - a "temporary password" would just
  // be a value the employee could never actually use to log in. This column
  // just can't be null; the real credential lives in InsForge once they
  // sign up with this email.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), parseInt(process.env.BCRYPT_ROUNDS) || 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      status: 'ACTIVE',
      permissions: permissions && permissions.length > 0 ? permissions : undefined,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      permissions: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'EMPLOYEE_ACCOUNT_CREATED',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email, role, permissions },
      ipAddress: req.ip,
    },
  });

  // Same linking mechanism as label-invited artists: they sign up normally
  // with this exact email, and POST /auth/sync-insforge-user attaches their
  // new InsForge identity to this pre-provisioned (already-roled) row by
  // email on first sync. NODE_ENV !== 'production' also logs the register
  // link so this is testable without SMTP configured.
  const registerUrl = `${process.env.FRONTEND_URL || 'https://eajmusic.com'}/register`;
  const invitationSent = await sendEmail({
    to: user.email,
    from: EMAIL_FROM.support,
    subject: 'You\'ve been added to the EAJMUSIC team',
    html: employeeInvitationEmailHtml({ name, role, email: user.email, registerUrl }),
  });
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[EMPLOYEE INVITATION] ${user.email} -> ${registerUrl}\n`);
  }

  res.status(201).json({
    success: true,
    message: 'Employee account created successfully',
    user,
    invitationSent,
    registerUrl,
  });
}));

router.get('/users/:id', requirePermission('users:read'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      countryCode: true,
      createdAt: true,
      lastLoginAt: true,
      subscription: true,
      wallet: true,
      artistProfiles: true,
      releases: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: { releases: true, payouts: true },
      },
    },
  });

  if (!user) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'User not found',
    });
  }

  res.json({ user });
}));

router.patch('/users/:id/status', requirePermission('users:status'), validate(updateUserStatusSchema), asyncHandler(async (req, res) => {
  const { status } = req.body;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: user.id,
      newValues: { status },
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: `User ${status === 'SUSPENDED' ? 'suspended' : 'activated'} successfully`,
    user,
  });
}));

// Super-Admin-only: role changes (including granting ADMIN/SUPPORT/REVIEWER/
// FINANCE/SUPER_ADMIN) are the most sensitive privilege-escalation surface
// in the admin API.
router.patch('/users/:id/role', requireRole('SUPER_ADMIN'), validate(updateUserRoleSchema), asyncHandler(async (req, res) => {
  const { role } = req.body;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: user.id,
      newValues: { role },
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: 'User role updated successfully',
    user,
  });
}));

// ===========================================
// RELEASES MANAGEMENT
// ===========================================
router.get('/releases', requirePermission('releases:read'), asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;

  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { artistProfile: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [releases, total] = await Promise.all([
    prisma.release.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        artistProfile: {
          select: { id: true, name: true, avatarUrl: true },
        },
        tracks: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.release.count({ where }),
  ]);

  res.json({
    releases: releases.map((r) => withAdminCoverUrl(req, r)),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

router.get('/releases/pending', requirePermission('releases:read'), asyncHandler(async (req, res) => {
  const releases = await prisma.release.findMany({
    where: { status: 'PENDING' },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      artistProfile: {
        select: { id: true, name: true, avatarUrl: true },
      },
      tracks: {
        include: { contributors: true },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });

  res.json({ releases: releases.map((r) => withAdminCoverUrl(req, r)) });
}));

router.get('/releases/:id', requirePermission('releases:read'), asyncHandler(async (req, res) => {
  const release = await prisma.release.findUnique({
    where: { id: req.params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      artistProfile: true,
      label: true,
      tracks: {
        include: { contributors: true },
        orderBy: { trackNumber: 'asc' },
      },
    },
  });

  if (!release) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Release not found',
    });
  }

  res.json({ release: withAdminCoverUrl(req, release) });
}));

// Streams the release's cover art through the API instead of the public
// /uploads/images/... path - see withAdminCoverUrl() above for why, and its
// caveat about /uploads still serving the same object unauthenticated.
router.get('/releases/:id/cover', requirePermission('releases:read'), asyncHandler(async (req, res) => {
  const release = await prisma.release.findUnique({
    where: { id: req.params.id },
    select: { coverArtKey: true, coverArtUrl: true },
  });

  if (!release) {
    return res.status(404).json({ error: 'Not Found', message: 'Release not found' });
  }

  // Older rows may only have coverArtUrl (no coverArtKey) - derive the
  // `images/<file>` object key from the URL's tail as a fallback.
  const objectKey = release.coverArtKey
    || (release.coverArtUrl ? release.coverArtUrl.split('/uploads/')[1] : null);

  if (parseUploadKey(objectKey)?.type !== 'images') {
    return res.status(404).json({ error: 'Not Found', message: 'This release has no cover art' });
  }

  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
  const contentType = mimeTypes[path.extname(objectKey).toLowerCase()] || 'application/octet-stream';

  const minioStream = await getObjectStream(objectKey);
  if (minioStream) {
    res.setHeader('Content-Type', contentType);
    minioStream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
    return minioStream.pipe(res);
  }

  const localPath = await localUploadPath(process.env.UPLOAD_DIR || './uploads', objectKey);
  if (localPath) {
    return res.sendFile(localPath);
  }

  res.status(404).json({ error: 'Not Found', message: 'Cover art file not found in storage' });
}));

router.post('/releases/:id/review', requirePermission('releases:approve'), validate(adminReviewSchema), asyncHandler(async (req, res) => {
  const { action, reason } = req.body;

  const release = await prisma.release.findUnique({
    where: { id: req.params.id },
  });

  if (!release) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Release not found',
    });
  }

  if (release.status !== 'PENDING') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Release is not pending review',
    });
  }

  const newStatus = action === 'APPROVE' ? 'LIVE' : 'REJECTED';

  const updatedRelease = await prisma.release.update({
    where: { id: req.params.id },
    data: {
      status: newStatus,
      ...(action === 'APPROVE' && { approvedAt: new Date() }),
      ...(action === 'REJECT' && { rejectionReason: reason }),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: action === 'APPROVE' ? 'RELEASE_APPROVED' : 'RELEASE_REJECTED',
      entityType: 'Release',
      entityId: release.id,
      newValues: { status: newStatus, reason },
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: `Release ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
    release: updatedRelease,
  });
}));

// ===========================================
// TAKEDOWNS
// ===========================================
router.get('/takedowns', requirePermission('takedowns:read'), asyncHandler(async (req, res) => {
  const takedowns = await prisma.takedownRequest.findMany({
    include: {
      release: {
        include: {
          artistProfile: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ takedowns });
}));

router.post('/takedowns/:id/resolve', requirePermission('takedowns:execute'), asyncHandler(async (req, res) => {
  const { action, resolution } = req.body;

  const takedown = await prisma.takedownRequest.findUnique({
    where: { id: req.params.id },
  });

  if (!takedown) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Takedown request not found',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.takedownRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'resolved',
        resolution,
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
      },
    });

    if (action === 'TAKEDOWN') {
      await tx.release.update({
        where: { id: takedown.releaseId },
        data: { status: 'TAKEDOWN' },
      });
    }
  });

  res.json({
    success: true,
    message: 'Takedown request resolved',
  });
}));

// ===========================================
// PAYOUTS
// ===========================================
router.get('/payouts', requirePermission('payouts:read'), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const where = status ? { status } : {};

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { requestedAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.payout.count({ where }),
  ]);

  res.json({
    payouts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

router.post('/payouts/:id/process', requirePermission('payouts:process'), asyncHandler(async (req, res) => {
  const payout = await processPayout(prisma, req.params.id, req.body);
  res.json({ success: true, message: 'Payout processed', payout });
}));

// ===========================================
// BULK PAYOUT IMPORT (CSV)
// ===========================================
router.post('/payouts/bulk-complete', requirePermission('payouts:process'), asyncHandler(async (req, res) => {
  const { payouts } = req.body;
  if (!Array.isArray(payouts) || payouts.length === 0 || payouts.length > 500) {
    return res.status(400).json({ error: 'Provide between 1 and 500 payout records' });
  }
  const results = [];
  for (const record of payouts) {
    try {
      const payout = await importCompletedPayout(prisma, record, req.user.id);
      results.push({ email: record.email, success: true, payoutId: payout.id });
    } catch (error) {
      const message = error.name === 'ZodError' ? 'Invalid payout record' : (error.statusCode ? error.message : 'Payout could not be imported');
      results.push({ email: record?.email || 'unknown', success: false, message });
    }
  }
  const successful = results.filter(result => result.success).length;
  res.json({ success: true, results, summary: { total: payouts.length, successful, failed: payouts.length - successful } });
}));

// ===========================================
// ANNOUNCEMENTS
// ===========================================
router.get('/announcements', requirePermission('announcements:manage'), asyncHandler(async (req, res) => {
  const announcements = await prisma.announcement.findMany({
    include: {
      author: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ announcements });
}));

router.post('/announcements', requirePermission('announcements:manage'), asyncHandler(async (req, res) => {
  const { title, content, type, targetAudience, startsAt, expiresAt } = req.body;

  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      type: type || 'info',
      targetAudience: targetAudience || 'all',
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user.id,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Announcement created',
    announcement,
  });
}));

router.patch('/announcements/:id', requirePermission('announcements:manage'), asyncHandler(async (req, res) => {
  const { title, content, type, targetAudience, isActive, startsAt, expiresAt } = req.body;

  const announcement = await prisma.announcement.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(content && { content }),
      ...(type && { type }),
      ...(targetAudience && { targetAudience }),
      ...(isActive !== undefined && { isActive }),
      ...(startsAt && { startsAt: new Date(startsAt) }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
  });

  res.json({
    success: true,
    message: 'Announcement updated',
    announcement,
  });
}));

router.delete('/announcements/:id', requirePermission('announcements:manage'), asyncHandler(async (req, res) => {
  await prisma.announcement.delete({
    where: { id: req.params.id },
  });

  res.json({
    success: true,
    message: 'Announcement deleted',
  });
}));

// ===========================================
// SUPPORT TICKETS
// ===========================================

// Staff-initiated ticket - lets a support agent reach out to an artist/label
// first, instead of only ever replying to tickets the user opened themselves
// (see POST /artist/tickets in support.js for that direction).
router.post('/tickets', requirePermission('tickets:reply'), asyncHandler(async (req, res) => {
  const { userId, subject, category, priority, message } = req.body;

  if (!userId || !subject || !message) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'userId, subject and message are required',
    });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  // Same category -> workflow mapping as the artist-facing form, so a
  // staff-opened copyright case gets the same state machine as one the
  // artist filed themselves.
  const workflowType = workflowTypeForCategory(category || 'General');
  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject,
      category: category || 'General',
      priority: priority || 'normal',
      status: 'OPEN',
      workflowType,
      workflowState: initialStateFor(workflowType),
      assignedTo: req.user.id,
      messages: {
        create: {
          userId: req.user.id,
          message,
        },
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      assignee: { select: { id: true, name: true } },
      messages: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'TICKET_CREATED_BY_STAFF',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      newValues: { subject, category: ticket.category, forUserId: userId },
      ipAddress: req.ip,
    },
  });

  res.status(201).json({ success: true, ticket });
}));

router.get('/tickets', requirePermission('tickets:read'), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const where = status ? { status } : {};

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.supportTicket.count({ where }),
  ]);

  res.json({
    tickets,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

router.get('/tickets/:id', requirePermission('tickets:read'), asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      assignee: {
        select: { id: true, name: true },
      },
      messages: {
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true, role: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Ticket not found',
    });
  }

  res.json({ ticket });
}));

router.post('/tickets/:id/reply', requirePermission('tickets:reply'), asyncHandler(async (req, res) => {
  const message = req.body.message?.trim();
  const isInternal = req.body.isInternal;
  if (!message) {
    return res.status(400).json({ error: 'Bad Request', message: 'message is required.' });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
  });

  if (!ticket) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Ticket not found',
    });
  }

  const newMessage = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      userId: req.user.id,
      message,
      isInternal: isInternal || false,
    },
  });

  // Always touch the ticket itself (bumps @updatedAt, so the requester's
  // list sorted by updatedAt DESC reflects this reply even when it doesn't
  // also change status - previously only the OPEN->IN_PROGRESS transition
  // did an update at all).
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: ticket.status === 'OPEN' ? { status: 'IN_PROGRESS', assignedTo: req.user.id } : {},
  });

  res.status(201).json({
    success: true,
    message: newMessage,
  });
}));

// Coarse status. Kept for GENERAL tickets and for the plain
// "mark this thread done" case; the risk-carrying categories move through
// POST /tickets/:id/workflow/transition below instead, which is the only
// path that can trigger a real backend operation.
router.patch('/tickets/:id/status', requirePermission('tickets:status'), asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid status',
    });
  }

  const existing = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    select: { workflowType: true },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
  }

  // A copyright claim or reversal can't be closed by flipping the coarse
  // status - that would leave the release held or the money un-reversed
  // while the case reads as finished.
  if (existing.workflowType !== 'GENERAL') {
    return res.status(409).json({
      error: 'Conflict',
      code: 'WORKFLOW_TICKET',
      message: `Este ticket sigue el flujo "${existing.workflowType}". Usa POST /admin/tickets/${req.params.id}/workflow/transition.`,
    });
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: {
      status,
      ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
    },
  });

  res.json({
    success: true,
    message: 'Ticket status updated',
    ticket,
  });
}));

// ===========================================
// FINANCIAL REVERSALS (two-person rule)
// ===========================================
// The one money movement that no single person can complete. Requesting and
// approving are separate calls by separate people; the wallet is not touched
// until approval, and the rejection path exists so a bad request dies
// visibly instead of lingering as a pending claim on someone's balance.

router.get('/reversals', requirePermission('finance:read'), asyncHandler(async (req, res) => {
  const { status } = req.query;

  const reversals = await prisma.financialReversal.findMany({
    where: status ? { status } : {},
    include: {
      user: { select: { id: true, name: true, email: true } },
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      ticket: { select: { id: true, subject: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });

  res.json({
    reversals,
    // So the UI can show "you requested this, someone else must approve it"
    // without re-deriving the rule client-side.
    currentUserId: req.user.id,
  });
}));

router.post('/reversals', requirePermission('reversals:request'), asyncHandler(async (req, res) => {
  const { userId, amount, reason, ticketId, payoutId } = req.body;

  const value = Number(amount);
  if (!userId || !Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId y un amount mayor que 0 son obligatorios.' });
  }
  if (!String(reason || '').trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'El motivo es obligatorio: queda en la auditoría.' });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    return res.status(400).json({ error: 'Bad Request', message: 'Ese usuario no tiene wallet.' });
  }

  const reversal = await prisma.financialReversal.create({
    data: {
      userId,
      walletId: wallet.id,
      amount: value,
      currency: wallet.currency,
      reason: reason.trim(),
      ticketId: ticketId || null,
      payoutId: payoutId || null,
      requestedById: req.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'REVERSAL_REQUESTED',
      entityType: 'FinancialReversal',
      entityId: reversal.id,
      newValues: { userId, amount: value, reason: reason.trim(), ticketId: ticketId || null },
      ipAddress: req.ip,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Reverso solicitado. Requiere la aprobación de otra persona para ejecutarse.',
    reversal,
  });
}));

// The second signature. Executes the wallet movement on approval; rejects
// without touching money otherwise.
router.post('/reversals/:id/approve', requirePermission('reversals:approve'), asyncHandler(async (req, res) => {
  const { decision, note } = req.body;

  if (!['APPROVE', 'REJECT'].includes(decision)) {
    return res.status(400).json({ error: 'Bad Request', message: 'decision debe ser APPROVE o REJECT.' });
  }
  if (!String(note || '').trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'La nota de decisión es obligatoria.' });
  }

  const reversal = await prisma.financialReversal.findUnique({ where: { id: req.params.id } });
  if (!reversal) {
    return res.status(404).json({ error: 'Not Found', message: 'Reverso no encontrado.' });
  }
  if (reversal.status !== 'PENDING') {
    return res.status(409).json({
      error: 'Conflict',
      code: 'ALREADY_DECIDED',
      message: `Este reverso ya fue ${reversal.status === 'APPROVED' ? 'aprobado' : 'rechazado'}.`,
    });
  }

  // THE two-person rule. Not a permission check - FINANCE legitimately holds
  // both reversals:request and reversals:approve; what must differ is the
  // person. Also enforced by a CHECK constraint on the table, so a bug here
  // cannot produce a self-approved reversal.
  if (reversal.requestedById === req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      code: 'SELF_APPROVAL',
      message: 'No puedes aprobar un reverso que tú mismo solicitaste. Requiere una segunda persona.',
    });
  }

  if (decision === 'REJECT') {
    const rejected = await prisma.financialReversal.update({
      where: { id: reversal.id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        approvedById: req.user.id,
        approvedAt: new Date(),
        decisionNote: note.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'REVERSAL_REJECTED',
        entityType: 'FinancialReversal',
        entityId: reversal.id,
        oldValues: { status: 'PENDING' },
        newValues: { status: 'REJECTED', note: note.trim() },
        ipAddress: req.ip,
      },
    });

    return res.json({ success: true, message: 'Reverso rechazado. No se movió dinero.', reversal: rejected });
  }

  const executed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.financialReversal.updateMany({
      where: { id: reversal.id, status: 'PENDING' },
      data: { status: 'APPROVED', approvedById: req.user.id },
    });
    if (claimed.count !== 1) throw conflict('Reversal was already decided');
    const wallet = await tx.wallet.findUnique({ where: { id: reversal.walletId } });
    if (!wallet) {
      throw Object.assign(new Error('La wallet asociada ya no existe.'), { statusCode: 400 });
    }

    const before = Number(wallet.availableBalance);
    const value = Number(reversal.amount);
    if (before < value) {
      throw Object.assign(
        new Error(`Saldo disponible insuficiente: $${before.toFixed(2)} contra un reverso de $${value.toFixed(2)}.`),
        { statusCode: 400, code: 'INSUFFICIENT_BALANCE' }
      );
    }

    const debited = await tx.wallet.updateMany({
      where: { id: wallet.id, availableBalance: { gte: value } },
      data: { availableBalance: { decrement: value } },
    });
    if (debited.count !== 1) throw conflict('Insufficient balance');
    const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });

    const updated = await tx.financialReversal.update({
      where: { id: reversal.id },
      data: {
        status: 'APPROVED',
        approvedById: req.user.id,
        approvedAt: new Date(),
        decisionNote: note.trim(),
        balanceBefore: before,
        balanceAfter: Number(updatedWallet.availableBalance),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'REVERSAL_EXECUTED',
        entityType: 'FinancialReversal',
        entityId: reversal.id,
        oldValues: { status: 'PENDING', availableBalance: before },
        newValues: {
          status: 'APPROVED',
          availableBalance: Number(updatedWallet.availableBalance),
          amount: value,
          requestedById: reversal.requestedById,
          approvedById: req.user.id,
          note: note.trim(),
        },
        ipAddress: req.ip,
      },
    });

    return updated;
  });

  res.json({
    success: true,
    message: 'Reverso aprobado y ejecutado.',
    reversal: executed,
  });
}));

// ===========================================
// TICKET WORKFLOWS
// ===========================================

// The case file: current position, every move still legal from here (already
// filtered to what THIS caller may do), and the full transition history.
router.get('/tickets/:id/workflow', requirePermission('tickets:read'), asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      workflowEvents: {
        include: { actor: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      reversals: {
        include: {
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { requestedAt: 'desc' },
      },
    },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
  }

  const all = availableTransitions(ticket.workflowType, ticket.workflowState);

  res.json({
    workflowType: ticket.workflowType,
    workflowState: ticket.workflowState,
    isTerminal: isTerminalState(ticket.workflowType, ticket.workflowState),
    relatedReleaseId: ticket.relatedReleaseId,
    relatedPayoutId: ticket.relatedPayoutId,
    // `allowed` is what this caller can actually click; `blocked` is shown
    // greyed out with the permission it needs, so an operator can see the
    // next step exists and who to hand it to rather than hitting a dead end.
    allowed: all.filter((t) => userHasPermission(req.user, t.permission)),
    blocked: all.filter((t) => !userHasPermission(req.user, t.permission)),
    history: ticket.workflowEvents,
    reversals: ticket.reversals,
  });
}));

// Advance the case. Validates the move against the state machine, checks the
// per-transition permission, applies the declared backend effect, and writes
// both the case-file event and a platform AuditLog entry - all in one
// transaction, so a ticket can never advance without its effect landing.
router.post('/tickets/:id/workflow/transition', requirePermission('tickets:read'), asyncHandler(async (req, res) => {
  const { to, note, amount } = req.body;

  if (!to) {
    return res.status(400).json({ error: 'Bad Request', message: 'Falta el estado destino ("to").' });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
  }

  const check = validateTransition({
    workflowType: ticket.workflowType,
    from: ticket.workflowState,
    to,
    note,
    hasPermission: (permission) => userHasPermission(req.user, permission),
  });

  if (!check.ok) {
    // A permission failure is a 403; everything else is the caller asking
    // for a move that doesn't exist or isn't ready.
    const status = check.code === 'FORBIDDEN_TRANSITION' ? 403 : 400;
    return res.status(status).json({ error: status === 403 ? 'Forbidden' : 'Bad Request', code: check.code, message: check.message });
  }

  const { transition } = check;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const effectResult = transition.effect
        ? await applyEffect(transition.effect, tx, ticket, { amount, note, actorId: req.user.id })
        : null;

      const updated = await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          workflowState: to,
          status: coarseStatusFor(ticket.workflowType, to),
          ...(transition.terminal && { resolvedAt: new Date() }),
        },
      });

      const event = await tx.ticketWorkflowEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user.id,
          fromState: ticket.workflowState,
          toState: to,
          effect: transition.effect,
          note: note || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'TICKET_WORKFLOW_TRANSITION',
          entityType: 'SupportTicket',
          entityId: ticket.id,
          oldValues: { workflowState: ticket.workflowState },
          newValues: {
            workflowState: to,
            workflowType: ticket.workflowType,
            effect: transition.effect,
            effectResult,
            note: note || null,
          },
          ipAddress: req.ip,
        },
      });

      return { updated, event, effectResult };
    });

    res.json({
      success: true,
      message: `Ticket movido a "${to}".`,
      ticket: result.updated,
      event: result.event,
      effectResult: result.effectResult,
    });
  } catch (err) {
    if (err instanceof WorkflowEffectError) {
      return res.status(err.statusCode).json({ error: 'Bad Request', code: err.code, message: err.message });
    }
    throw err;
  }
}));

// Link a ticket to the release or payout it is actually about. A copyright
// or takedown case can't execute anything until this is set (the effects
// refuse to run without it).
router.patch('/tickets/:id/link', requirePermission('tickets:status'), asyncHandler(async (req, res) => {
  const { releaseId, payoutId } = req.body;

  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    return res.status(404).json({ error: 'Not Found', message: 'Ticket not found' });
  }

  if (releaseId) {
    const release = await prisma.release.findUnique({ where: { id: releaseId }, select: { id: true } });
    if (!release) {
      return res.status(400).json({ error: 'Bad Request', message: 'Ese release no existe.' });
    }
  }
  if (payoutId) {
    const payout = await prisma.payout.findUnique({ where: { id: payoutId }, select: { id: true } });
    if (!payout) {
      return res.status(400).json({ error: 'Bad Request', message: 'Ese payout no existe.' });
    }
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      ...(releaseId !== undefined && { relatedReleaseId: releaseId || null }),
      ...(payoutId !== undefined && { relatedPayoutId: payoutId || null }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'TICKET_LINKED',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      oldValues: { relatedReleaseId: ticket.relatedReleaseId, relatedPayoutId: ticket.relatedPayoutId },
      newValues: { relatedReleaseId: updated.relatedReleaseId, relatedPayoutId: updated.relatedPayoutId },
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, ticket: updated });
}));

// Manually assign a ticket to a staff member (SUPPORT/ADMIN/SUPER_ADMIN).
// Pass assigneeId: null to unassign. Complements the auto-assign-on-first-
// reply behavior in POST /tickets/:id/reply above - that covers the common
// case of "whoever replies first owns it", this covers a lead manually
// routing a ticket to a specific teammate.
router.patch('/tickets/:id/assign', requirePermission('tickets:assign'), asyncHandler(async (req, res) => {
  const { assigneeId } = req.body;

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || !['SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(assignee.role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'assigneeId must belong to a SUPPORT, ADMIN or SUPER_ADMIN user',
      });
    }
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { assignedTo: assigneeId || null },
    include: { assignee: { select: { id: true, name: true } } },
  });

  res.json({
    success: true,
    message: assigneeId ? 'Ticket assigned' : 'Ticket unassigned',
    ticket,
  });
}));

// ===========================================
// AUDIT LOGS
// ===========================================
router.get('/audit-logs', requirePermission('audit:read'), asyncHandler(async (req, res) => {
  const { action, userId, entityType, page = 1, limit = 50 } = req.query;

  const where = {
    ...(action && { action: { contains: action, mode: 'insensitive' } }),
    ...(userId && { userId }),
    ...(entityType && { entityType }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ===========================================
// FINANCE OVERVIEW
// ===========================================
router.get('/finance/overview', requirePermission('finance:read'), asyncHandler(async (req, res) => {
  const [totalRevenue, totalCommissions, totalPayouts, pendingPayouts, completedPayouts, monthlyRevenue] = await Promise.all([
    prisma.royalty.aggregate({ _sum: { grossRevenue: true } }),
    prisma.royalty.aggregate({ _sum: { commissionAmount: true } }),
    prisma.payout.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true }, _count: true }),
    prisma.payout.count({ where: { status: 'COMPLETED' } }),
    // Last 12 months revenue
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(gross_revenue) as revenue,
        SUM(commission_amount) as commission
      FROM royalties
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `,
  ]);

  res.json({
    totalRevenue: totalRevenue._sum.grossRevenue || 0,
    totalCommissions: totalCommissions._sum.commissionAmount || 0,
    totalPayoutsAmount: totalPayouts._sum.amount || 0,
    pendingPayoutsAmount: pendingPayouts._sum.amount || 0,
    pendingPayoutsCount: pendingPayouts._count || 0,
    completedPayoutsCount: completedPayouts,
    monthlyRevenue: monthlyRevenue || [],
  });
}));

// Look up a specific artist's wallet - used by the Finance Hub's "Manage
// Artist Balance" panel to show current figures before an adjustment.
router.get('/users/:id/wallet', requirePermission('finance:read'), asyncHandler(async (req, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.params.id } });
  if (!wallet) {
    return res.status(404).json({ error: 'Not Found', message: 'This user has no wallet yet' });
  }
  res.json({ wallet });
}));

// Manually adjust a user's available/pending balance (e.g. correcting an
// error, granting a goodwill credit). Every field is optional so the caller
// can adjust just one of the two. No new ledger/transaction model was added
// for this - the before/after values are captured on the AuditLog entry,
// which is enough for a manual, infrequent admin action; a real per-entry
// transaction history would be schema work for a later pass.
// wallets:adjust, not finance:write - this is the one route that moves a
// real balance by hand, so it stays with FINANCE (and SUPER_ADMIN) even
// though ADMIN can see the same figures via finance:read above.
router.patch('/users/:id/wallet', requirePermission('wallets:adjust'), asyncHandler(async (req, res) => {
  const { availableBalance, pendingBalance, reason } = req.body;

  if (availableBalance === undefined && pendingBalance === undefined) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Provide availableBalance and/or pendingBalance to update',
    });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'A reason is required for balance adjustments' });
  }

  const existing = await prisma.wallet.findUnique({ where: { userId: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Not Found', message: 'This user has no wallet yet' });
  }

  const wallet = await prisma.wallet.update({
    where: { userId: req.params.id },
    data: {
      ...(availableBalance !== undefined && { availableBalance }),
      ...(pendingBalance !== undefined && { pendingBalance }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'WALLET_BALANCE_ADJUSTED',
      entityType: 'Wallet',
      entityId: wallet.id,
      oldValues: {
        availableBalance: existing.availableBalance,
        pendingBalance: existing.pendingBalance,
      },
      newValues: {
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        reason: reason.trim(),
        targetUserId: req.params.id,
      },
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, wallet });
}));

// ===========================================
// CHANGE USER PLAN
// ===========================================
router.patch('/users/:id/plan', requirePermission('users:write'), asyncHandler(async (req, res) => {
  const { plan } = req.body;

  const validPlans = ['FREE', 'PRO', 'LABEL_PLUS', 'ENTERPRISE'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid plan type' });
  }

  const commissionRates = { FREE: 15, PRO: 0, LABEL_PLUS: 5, ENTERPRISE: 3 };
  const maxProfiles = { FREE: 1, PRO: 3, LABEL_PLUS: 10, ENTERPRISE: 50 };

  const subscription = await prisma.subscription.upsert({
    where: { userId: req.params.id },
    update: {
      plan,
      commissionRate: commissionRates[plan],
      maxArtistProfiles: maxProfiles[plan],
    },
    create: {
      userId: req.params.id,
      plan,
      commissionRate: commissionRates[plan],
      maxArtistProfiles: maxProfiles[plan],
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'USER_PLAN_CHANGED',
      entityType: 'Subscription',
      entityId: subscription.id,
      newValues: { plan, userId: req.params.id },
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, message: 'User plan updated', subscription });
}));

// ===========================================
// PLATFORM SETTINGS
// ===========================================
// Matches AdminService.getSettings(): Record<string, { value, description }>
router.get('/settings', requirePermission('settings:read'), asyncHandler(async (req, res) => {
  const settings = await prisma.platformSetting.findMany();
  const settingsMap = {};
  settings.forEach(s => {
    settingsMap[s.key] = { value: s.value, description: s.description || '' };
  });
  res.json(settingsMap);
}));

router.put('/settings/:key', requirePermission('settings:write'), validate(updateSettingSchema), asyncHandler(async (req, res) => {
  const { value, description } = req.body;

  const setting = await prisma.platformSetting.upsert({
    where: { key: req.params.key },
    update: { value, ...(description !== undefined && { description }) },
    create: { key: req.params.key, value, description: description || '' },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'SETTING_UPDATED',
      entityType: 'PlatformSetting',
      entityId: req.params.key,
      newValues: { key: req.params.key, value },
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, setting });
}));

// ===========================================
// TESTIMONIALS MODERATION
// ===========================================
router.get('/testimonials', requirePermission('testimonials:moderate'), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

  const where = status ? { status } : {};

  const [testimonials, total] = await Promise.all([
    prisma.testimonial.findMany({
      where,
      include: {
        artistProfile: { select: { id: true, name: true, avatarUrl: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.testimonial.count({ where }),
  ]);

  res.json({
    data: testimonials,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 0,
  });
}));

router.patch('/testimonials/:id', requirePermission('testimonials:moderate'), validate(moderateTestimonialSchema), asyncHandler(async (req, res) => {
  const { status } = req.body;

  const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: 'Not Found', message: 'Testimonial not found' });
  }

  const testimonial = await prisma.testimonial.update({
    where: { id: req.params.id },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedById: req.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'TESTIMONIAL_MODERATED',
      entityType: 'Testimonial',
      entityId: testimonial.id,
      newValues: { status },
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: `Testimonial ${status === 'APPROVED' ? 'approved' : 'rejected'}`,
    testimonial,
  });
}));

// ===========================================
// CONTRIBUTOR MATCH REQUESTS (Grupo 4.2)
// ===========================================
// Surfaced when a newly-registered ArtistProfile name matches contributor
// credits that predate any account (see contributorMatchService.js). A
// human always approves before catalog gets reassigned.
router.get('/contributor-matches', requirePermission('contributors:approve'), asyncHandler(async (req, res) => {
  const { status = 'PENDING' } = req.query;
  const matches = await prisma.contributorMatchRequest.findMany({
    where: { status },
    include: { matchedUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ matches });
}));

router.patch('/contributor-matches/:id', requirePermission('contributors:approve'), asyncHandler(async (req, res) => {
  const { action } = req.body; // 'APPROVE' | 'REJECT'
  if (!['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ error: 'Bad Request', message: 'action debe ser APPROVE o REJECT.' });
  }

  const match = await prisma.contributorMatchRequest.findUnique({ where: { id: req.params.id } });
  if (!match) {
    return res.status(404).json({ error: 'Not Found', message: 'Match request not found' });
  }
  if (match.status !== 'PENDING') {
    return res.status(400).json({ error: 'Bad Request', message: 'This match request was already resolved.' });
  }

  if (action === 'APPROVE') {
    const profile = await prisma.artistProfile.findFirst({
      where: { userId: match.matchedUserId, name: { equals: match.contributorName, mode: 'insensitive' } },
    });
    if (!profile) {
      return res.status(400).json({ error: 'Bad Request', message: 'The matched user no longer has a profile with this name.' });
    }

    await prisma.$transaction([
      prisma.trackContributor.updateMany({
        where: { artistProfileId: null, name: { equals: match.contributorName, mode: 'insensitive' } },
        data: { artistProfileId: profile.id },
      }),
      prisma.contributorMatchRequest.update({
        where: { id: match.id },
        data: { status: 'APPROVED', resolvedAt: new Date(), resolvedBy: req.user.id },
      }),
    ]);
  } else {
    await prisma.contributorMatchRequest.update({
      where: { id: match.id },
      data: { status: 'REJECTED', resolvedAt: new Date(), resolvedBy: req.user.id },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: `CONTRIBUTOR_MATCH_${action}D`,
      entityType: 'ContributorMatchRequest',
      entityId: match.id,
      newValues: { contributorName: match.contributorName, matchedUserId: match.matchedUserId },
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, message: `Match ${action === 'APPROVE' ? 'aprobado' : 'rechazado'}` });
}));

export default router;
