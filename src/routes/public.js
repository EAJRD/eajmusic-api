import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../validators/auth.js';
import { submitTestimonialSchema } from '../validators/testimonial.js';
import { notifyN8n } from '../services/n8nWebhookService.js';

const router = Router();

// Sane defaults if the `brand_config` PlatformSetting has never been set.
const DEFAULT_BRAND_CONFIG = {
  siteName: 'EAJMUSIC',
  primaryColor: '#7c3aed',
  logoUrl: null,
  faviconUrl: null,
};

// ===========================================
// THEME (cheap, cacheable, no auth)
// ===========================================
router.get('/theme', asyncHandler(async (req, res) => {
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'brand_config' } });
  res.set('Cache-Control', 'public, max-age=60');
  res.json(setting?.value ?? DEFAULT_BRAND_CONFIG);
}));

// ===========================================
// TALENT DIRECTORY (public, /talent on eajmusic.com)
// ===========================================
// Every artist profile with a name is listed - the platform doesn't have
// enough real artists yet for a "verified only" filter to make sense (it'd
// just be an empty page). `isVerified` is still returned so the frontend can
// badge those artists once there's enough of a mix for that distinction to
// matter.
router.get('/talent', asyncHandler(async (req, res) => {
  const { page = 1, limit = 24 } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 24;

  const [artists, total] = await Promise.all([
    prisma.artistProfile.findMany({
      select: { id: true, name: true, bio: true, avatarUrl: true, isVerified: true },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.artistProfile.count(),
  ]);

  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    data: artists,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 0,
  });
}));

// ===========================================
// ANNOUNCEMENTS (public, active only)
// ===========================================
// Admin manages the full CRUD at /admin/announcements - this is the read-only
// feed the 3 frontend domains actually render. Short cache since these are
// more time-sensitive than /theme (an admin publishing an urgent announcement
// shouldn't have to wait a full minute to see it live).
router.get('/announcements', asyncHandler(async (req, res) => {
  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      title: true,
      content: true,
      type: true,
      targetAudience: true,
      startsAt: true,
    },
    orderBy: { startsAt: 'desc' },
  });

  res.set('Cache-Control', 'public, max-age=30');
  res.json({ announcements });
}));

// ===========================================
// TESTIMONIALS (public submission + approved listing)
// ===========================================

// This is the most spam-exposed endpoint in the public API (anonymous,
// unauthenticated, free-text submission) - rate limit it harder than the
// general /api/ limiter.
const testimonialSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Too many submissions from this IP, please try again later.' },
});

// Same exposure as testimonials (anonymous, unauthenticated, free-text) -
// newsletter/contact only had the generic 100-req/15min-per-IP limiter
// shared across the entire /api/ surface, which does nothing to stop a
// script from flooding either table specifically.
const publicSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Too many submissions from this IP, please try again later.' },
});

// NOTE: ArtistProfile has no slug/handle field in the current schema (id,
// name, bio, avatarUrl, ... only) - per the task constraints we're not
// migrating the schema for this, so `:artistSlug` here is actually the
// ArtistProfile.id (a UUID) until a real slug/handle column exists.
router.post('/testimonials/:artistSlug', testimonialSubmitLimiter, validate(submitTestimonialSchema), asyncHandler(async (req, res) => {
  const artistProfile = await prisma.artistProfile.findUnique({
    where: { id: req.params.artistSlug },
    select: { id: true },
  });

  if (!artistProfile) {
    return res.status(404).json({ error: 'Not Found', message: 'Artist not found' });
  }

  const { quote, photoUrl } = req.body;

  const testimonial = await prisma.testimonial.create({
    data: {
      artistId: artistProfile.id,
      quote,
      photoUrl: photoUrl || null,
      status: 'PENDING',
    },
  });

  res.status(201).json({
    success: true,
    message: 'Thank you! Your testimonial has been submitted for review.',
    testimonial: { id: testimonial.id, status: testimonial.status },
  });

  // Fire-and-forget notification to n8n (Super Admin/moderators queue
  // alert). Intentionally not awaited - never blocks the response above,
  // and no-ops safely if n8n isn't configured/reachable.
  notifyN8n('testimonial-submitted', {
    testimonialId: testimonial.id,
    artistProfileId: artistProfile.id,
    quote,
    submittedAt: testimonial.createdAt,
  });
}));

router.get('/testimonials', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

  const where = { status: 'APPROVED' };

  const [testimonials, total] = await Promise.all([
    prisma.testimonial.findMany({
      where,
      include: {
        artistProfile: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
      },
      orderBy: { reviewedAt: 'desc' },
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/newsletter', publicSubmitLimiter, asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Bad Request', message: 'A valid email is required' });
  }

  const subscriber = await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: { status: 'SUBSCRIBED' },
    create: { email },
  });

  res.status(201).json({ success: true, subscriber });
}));

router.post('/contact', publicSubmitLimiter, asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const message = req.body.message?.trim();
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Bad Request', message: 'Name, email, and message are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Bad Request', message: 'A valid email is required' });
  }

  const contactMessage = await prisma.contactMessage.create({
    data: { name, email, message },
  });

  res.status(201).json({ success: true, contactMessage });
}));

export default router;
