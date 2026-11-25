import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';

// Cookie first (the primary auth mechanism now that tokens are issued as
// httpOnly cookies scoped to .eajmusic.com), falling back to the
// Authorization: Bearer header - keeps local/API-tool testing (curl,
// Postman, etc.) working without needing to fabricate a cookie jar.
function extractToken(req) {
  if (req.cookies?.[ACCESS_COOKIE]) {
    return req.cookies[ACCESS_COOKIE];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

// Verify JWT token middleware
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type !== 'access' || typeof decoded.sid !== 'string' || typeof decoded.userId !== 'string') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid access token' });
    }

    // Verify session exists and is valid
    const session = await prisma.session.findFirst({
      where: {
        id: decoded.sid,
        userId: decoded.userId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Session expired or invalid',
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        permissions: true,
        emailVerified: true,
        onboardingCompletedAt: true,
        subscription: {
          select: {
            plan: true,
            commissionRate: true,
            maxArtistProfiles: true,
            isActive: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account suspended. Contact support.',
      });
    }

    if (user.status === 'DELETED') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Account deleted',
      });
    }

    // Update last activity - throttled and not awaited. This used to run a
    // synchronous UPDATE on every single authenticated request (doubling the
    // DB round-trips for the whole API) for a field nothing in the codebase
    // ever reads back. Throttling to once per 5 minutes per session keeps it
    // roughly meaningful if it's ever used for "active sessions" reporting,
    // without paying for a write on every request; not awaiting it means a
    // slow/failed write here can never add latency to (or fail) the request.
    const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;
    if (Date.now() - session.lastActivityAt.getTime() > ACTIVITY_THROTTLE_MS) {
      prisma.session.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }

    req.user = user;
    req.sessionId = session.id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
    next(error);
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type !== 'access' || typeof decoded.sid !== 'string' || typeof decoded.userId !== 'string') return next();
    const session = await prisma.session.findFirst({
      where: { id: decoded.sid, userId: decoded.userId, expiresAt: { gt: new Date() } },
    });
    if (!session) return next();

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        permissions: true,
      },
    });

    if (user && user.status === 'ACTIVE') {
      req.user = user;
    }

    next();
  } catch {
    next();
  }
};

// Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
    }

    next();
  };
};

// Check if user is admin
export const isAdmin = authorize('ADMIN', 'SUPER_ADMIN');

// Check if user is artist or above
export const isArtist = authorize('ARTIST', 'LABEL', 'ADMIN', 'SUPER_ADMIN');
