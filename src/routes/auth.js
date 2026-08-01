import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { verifyInsforgeToken } from '../middleware/insforgeAuth.js';
import { validate, updateProfileSchema, changePasswordSchema } from '../validators/auth.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/cookies.js';
import { getOrCreateDefaultLabelId } from '../services/labelService.js';

const SUBSCRIPTION_SELECT = { plan: true, commissionRate: true, isActive: true, expiresAt: true };

const router = Router();

// Generate tokens. Access tokens are short-lived by design (they live in a
// cookie sent on every request); refresh tokens are long-lived and only
// used against POST /auth/refresh.
const generateTokens = (userId, rememberMe = false) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? '30d' : process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

// ===========================================
// SYNC INSFORGE USER
// ===========================================
// InsForge (https://insforge.dev) is now the credential front door - signup,
// login, OAuth, email verification, and password reset all happen there via
// @insforge/sdk on the frontend (see AGENTS.md). This API never sees a
// password again for InsForge-backed accounts; it stays the source of truth
// for role/subscription/business data. The frontend calls this immediately
// after any InsForge auth event that yields a fresh accessToken (signUp,
// signInWithPassword, verifyEmail, OAuth code exchange) to exchange that
// token for this API's own session cookies - everything downstream
// (RBAC, `authenticate` middleware, etc.) is completely unchanged.
//
// This is now the ONLY way to obtain a session (the old bcrypt-based
// /register, /login, /forgot-password, /reset-password, /verify-email, and
// /resend-verification routes were removed - InsForge owns all of that).
router.post('/sync-insforge-user', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const insforgeToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!insforgeToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing InsForge access token' });
  }

  let decoded;
  try {
    decoded = await verifyInsforgeToken(insforgeToken);
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired InsForge token' });
  }

  const insforgeUserId = decoded.sub;
  const email = decoded.email?.toLowerCase();
  if (!insforgeUserId || !email) {
    return res.status(400).json({ error: 'Bad Request', message: 'InsForge token is missing sub/email' });
  }

  // name/accountType are only meaningful the first time a brand-new signup
  // provisions its business-data row; ignored on every later sync.
  const { name, accountType } = req.body;

  let user = await prisma.user.findUnique({
    where: { insforgeUserId },
    include: { subscription: { select: SUBSCRIPTION_SELECT } },
  });

  if (!user) {
    // Not linked yet. Either this is an existing (pre-InsForge) account
    // being linked by email on first sync (the migration case), or a
    // genuinely brand-new signup.
    const existingByEmail = await prisma.user.findUnique({ where: { email } });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { insforgeUserId, emailVerified: true },
        include: { subscription: { select: SUBSCRIPTION_SELECT } },
      });
    } else {
      const role = accountType === 'LABEL' ? 'LABEL' : 'ARTIST';
      const displayName = name || email.split('@')[0];
      // Unusable placeholder - InsForge owns the real credential now, this
      // column just can't be null (schema still shared with pre-InsForge
      // rows). Real bcrypt hash so nothing downstream has to special-case it.
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), parseInt(process.env.BCRYPT_ROUNDS) || 12);

      const createdId = await prisma.$transaction(async (tx) => {
        const defaultLabelId = role === 'ARTIST' ? await getOrCreateDefaultLabelId(tx) : null;
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: displayName,
            role,
            status: 'ACTIVE',
            emailVerified: true,
            insforgeUserId,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`,
            ...(defaultLabelId && { labelId: defaultLabelId }),
          },
        });
        await tx.subscription.create({ data: { userId: created.id, plan: 'FREE', commissionRate: 15, maxArtistProfiles: 1 } });
        await tx.wallet.create({ data: { userId: created.id } });
        if (role === 'ARTIST') {
          await tx.artistProfile.create({ data: { userId: created.id, name: created.name, avatarUrl: created.avatarUrl } });
        }
        return created.id;
      });

      user = await prisma.user.findUnique({
        where: { id: createdId },
        include: { subscription: { select: SUBSCRIPTION_SELECT } },
      });
    }
  }

  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Forbidden', message: 'Your account has been suspended. Please contact support.' });
  }
  if (user.status === 'DELETED') {
    return res.status(401).json({ error: 'Unauthorized', message: 'This account has been deleted.' });
  }

  const { accessToken, refreshToken } = generateTokens(user.id, true);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: jwt.sign({ t: Date.now() }, process.env.JWT_SECRET),
      refreshToken,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: req.ip },
  });

  setAuthCookies(res, { accessToken, refreshToken });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      subscription: user.subscription,
    },
    accessToken,
    refreshToken,
  });
}));

// ===========================================
// LOGOUT
// ===========================================
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // deleteMany instead of delete: never throw if the session already expired
  // or was cleaned up elsewhere - logout should always succeed and clear cookies.
  await prisma.session.deleteMany({
    where: { id: req.sessionId },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      ipAddress: req.ip,
    },
  });

  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

// ===========================================
// GET CURRENT USER
// ===========================================
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      countryCode: true,
      timezone: true,
      emailVerified: true,
      onboardingCompletedAt: true,
      createdAt: true,
      subscription: {
        select: {
          plan: true,
          commissionRate: true,
          maxArtistProfiles: true,
          isActive: true,
          expiresAt: true,
        },
      },
      artistProfiles: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          isVerified: true,
        },
      },
      wallet: {
        select: {
          availableBalance: true,
          pendingBalance: true,
          lifetimeEarnings: true,
        },
      },
    },
  });

  res.json({ user });
}));

// ===========================================
// UPDATE PROFILE
// ===========================================
router.patch('/profile', authenticate, validate(updateProfileSchema), asyncHandler(async (req, res) => {
  const { name, phone, countryCode, timezone } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(countryCode !== undefined && { countryCode }),
      ...(timezone && { timezone }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      phone: true,
      countryCode: true,
      timezone: true,
    },
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: updatedUser,
  });
}));

// ===========================================
// CHANGE PASSWORD
// ===========================================
router.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true, insforgeUserId: true },
  });

  // InsForge-linked accounts have a random, unusable placeholder as
  // passwordHash (InsForge owns the real credential) - "current password"
  // is meaningless for them and bcrypt.compare would just always fail with
  // a misleading "incorrect password" error. Point them at the real place
  // to change it instead.
  if (user.insforgeUserId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Tu contraseña se gestiona a través del inicio de sesión (InsForge). Usa "Olvidé mi contraseña" en la pantalla de inicio de sesión para cambiarla.',
      code: 'PASSWORD_MANAGED_BY_INSFORGE',
    });
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isValidPassword) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Current password is incorrect',
    });
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

  // Update password
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash },
  });

  // Invalidate all other sessions
  await prisma.session.deleteMany({
    where: {
      userId: req.user.id,
      id: { not: req.sessionId },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: req.user.id,
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

// ===========================================
// REFRESH TOKEN
// ===========================================
router.post('/refresh', asyncHandler(async (req, res) => {
  // Prefer the httpOnly cookie; fall back to the request body for the
  // legacy localStorage-based frontend flow during the transition.
  const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Refresh token is required',
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Find session with this refresh token
    const session = await prisma.session.findFirst({
      where: {
        userId: decoded.userId,
        refreshToken,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

    // Update session
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        lastActivityAt: new Date(),
      },
    });

    setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token',
    });
  }
}));

export default router;
