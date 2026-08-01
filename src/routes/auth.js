import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { verifyInsforgeToken } from '../middleware/insforgeAuth.js';
import { validate, registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from '../validators/auth.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/cookies.js';
import { getOrCreateDefaultLabelId } from '../services/labelService.js';
import { sendEmail, passwordResetEmailHtml, verificationEmailHtml } from '../services/emailService.js';

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
// REGISTER
// ===========================================
router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, name, accountType } = req.body;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'An account with this email already exists',
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

  // Create user with transaction
  const user = await prisma.$transaction(async (tx) => {
    // Every ARTIST defaults to the platform's own "EAJMUSIC" label until
    // they upgrade off FREE and move to a real one (PATCH /artist/label).
    // LABEL accounts don't get a managing label - they are one.
    const defaultLabelId = accountType === 'ARTIST' ? await getOrCreateDefaultLabelId(tx) : null;

    // Create user
    const newUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: accountType,
        status: 'ACTIVE', // In production, set to PENDING and verify email
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
        ...(defaultLabelId && { labelId: defaultLabelId }),
      },
    });

    // Create subscription (Free tier)
    await tx.subscription.create({
      data: {
        userId: newUser.id,
        plan: 'FREE',
        commissionRate: 15,
        maxArtistProfiles: 1,
      },
    });

    // Create wallet
    await tx.wallet.create({
      data: {
        userId: newUser.id,
      },
    });

    // Create default artist profile for artists
    if (accountType === 'ARTIST') {
      await tx.artistProfile.create({
        data: {
          userId: newUser.id,
          name: name,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
        },
      });
    }

    return newUser;
  });

  // Email verification - stateless JWT like the password-reset flow above,
  // no schema/DB storage needed. Sending is best-effort (sendEmail never
  // throws) and does NOT block registration or login: SMTP isn't configured
  // in production yet, so gating access on this would lock every new signup
  // out until that's set up. `user.emailVerified` just stays false and the
  // frontend can prompt to verify/resend without blocking the product.
  const verificationToken = jwt.sign(
    { userId: user.id, type: 'email_verification' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  const verifyBaseUrl = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${verifyBaseUrl}/verify-email?token=${verificationToken}`;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[EMAIL VERIFICATION] Token for ${user.email}: ${verifyUrl}\n`);
  }

  await sendEmail({
    to: user.email,
    subject: 'Verify Your Email - EAJMUSIC',
    html: verificationEmailHtml({ name: user.name, verifyUrl }),
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

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

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  // Set httpOnly cookies (primary auth path) - the JSON body still carries
  // the tokens too, for any code still reading them from the response body
  // during the frontend's transition off localStorage.
  setAuthCookies(res, { accessToken, refreshToken });

  // Return user data (without sensitive info)
  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    accessToken,
    refreshToken,
  });
}));

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
// LOGIN
// ===========================================
router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      subscription: {
        select: {
          plan: true,
          commissionRate: true,
          isActive: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });
  }

  // Check password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });
  }

  // Check user status
  if (user.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Your account has been suspended. Please contact support.',
    });
  }

  if (user.status === 'DELETED') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'This account has been deleted.',
    });
  }

  if (user.status === 'PENDING') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Please verify your email address to continue.',
    });
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id, rememberMe);

  // Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));

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

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  setAuthCookies(res, { accessToken, refreshToken });

  res.json({
    success: true,
    message: 'Login successful',
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

// ===========================================
// FORGOT PASSWORD
// ===========================================
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email is required' });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  }

  // Generate reset token (valid for 1 hour)
  const resetToken = jwt.sign(
    { userId: user.id, type: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Prefer the Origin the request actually came from so the link lands the
  // user back on whichever subdomain (main/artist/admin) they requested from,
  // instead of always sending them to FRONTEND_URL's single configured domain.
  const resetBaseUrl = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${resetBaseUrl}/reset-password?token=${resetToken}`;

  // Dev-only fallback so the flow is testable without SMTP configured.
  // Never log a live reset token in production - it's a bearer credential.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[PASSWORD RESET] Token for ${email}: ${resetUrl}\n`);
  }

  await sendEmail({
    to: email,
    subject: 'Reset Your Password - EAJMUSIC',
    html: passwordResetEmailHtml({ name: user.name, resetUrl }),
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    },
  });

  res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
}));

// ===========================================
// RESET PASSWORD
// ===========================================
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Bad Request', message: 'Token and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 8 characters' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Update password
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { passwordHash },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: decoded.userId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: decoded.userId,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: decoded.userId,
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
  } catch (error) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired reset token' });
  }
}));

// ===========================================
// VERIFY EMAIL
// ===========================================
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Bad Request', message: 'Token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'email_verification') {
      throw new Error('Invalid token type');
    }

    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
      select: { id: true, email: true, emailVerified: true },
    });

    res.json({ success: true, message: 'Email verified successfully.', user });
  } catch (error) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired verification link' });
  }
}));

// Authenticated - lets a user who lost/never got the original email trigger
// a fresh one. Same stateless-JWT approach as registration, so this is safe
// to call as many times as needed (each token is independently valid for
// 24h, none of them get invalidated by requesting another).
router.post('/resend-verification', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (user.emailVerified) {
    return res.json({ success: true, message: 'Email is already verified.' });
  }

  const verificationToken = jwt.sign(
    { userId: user.id, type: 'email_verification' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  const verifyBaseUrl = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${verifyBaseUrl}/verify-email?token=${verificationToken}`;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[EMAIL VERIFICATION] Token for ${user.email}: ${verifyUrl}\n`);
  }

  await sendEmail({
    to: user.email,
    subject: 'Verify Your Email - EAJMUSIC',
    html: verificationEmailHtml({ name: user.name, verifyUrl }),
  });

  res.json({ success: true, message: 'Verification email sent.' });
}));

export default router;
