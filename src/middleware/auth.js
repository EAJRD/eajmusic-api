import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ACCESS_COOKIE } from '../utils/cookies.js';

const prisma = new PrismaClient();

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify session exists and is valid
    const session = await prisma.session.findFirst({
      where: {
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

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
