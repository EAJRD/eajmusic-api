import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../validators/auth.js';
import { createReleaseSchema, updateReleaseSchema, submitReleaseSchema } from '../validators/release.js';
import { notifyN8n } from '../services/n8nWebhookService.js';

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication and an artist-facing role. Uses the
// rbac.js requireRole gate (not auth.js's ad-hoc isArtist helper) so this
// router participates in the same RBAC system as admin.js. Release
// approval/rejection itself lives entirely in admin.js (gated by
// requirePermission('releases:approve'/'releases:reject') for
// REVIEWER/ADMIN/SUPER_ADMIN) - everything below is scoped to the caller's
// own resources (userId: req.user.id), so there is no approval-adjacent
// logic here to open up to REVIEWER.
router.use(authenticate);
router.use(requireRole('ARTIST', 'LABEL', 'ADMIN', 'SUPER_ADMIN'));

// ===========================================
// STATS & DASHBOARD
// ===========================================
router.get('/stats', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user's releases
  const releases = await prisma.release.findMany({
    where: { userId },
    include: {
      tracks: {
        include: {
          streamingStats: true,
        },
      },
    },
  });

  // Calculate totals, and 30-day-vs-prior-30-day streams for monthlyGrowth
  let totalStreams = 0;
  let activeTracks = 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  let streamsLast30 = 0;
  let streamsPrior30 = 0;

  for (const release of releases) {
    for (const track of release.tracks) {
      if (track.status === 'READY') activeTracks += 1;
      for (const stat of track.streamingStats) {
        const streams = Number(stat.streams);
        totalStreams += streams;
        if (stat.date >= thirtyDaysAgo) {
          streamsLast30 += streams;
        } else if (stat.date >= sixtyDaysAgo) {
          streamsPrior30 += streams;
        }
      }
    }
  }

  const monthlyGrowth = streamsPrior30 > 0
    ? Number((((streamsLast30 - streamsPrior30) / streamsPrior30) * 100).toFixed(1))
    : (streamsLast30 > 0 ? 100 : 0);

  // Get wallet info
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  res.json({
    // Matches frontend's ArtistStats shape.
    totalReleases: releases.length,
    totalStreams,
    totalEarnings: Number(wallet?.lifetimeEarnings || 0),
    monthlyGrowth,
    activeTracks,
    // Bonus fields (not part of ArtistStats, kept for dashboard widgets).
    availableBalance: wallet?.availableBalance || 0,
    pendingBalance: wallet?.pendingBalance || 0,
    monthlyListeners: Math.floor(streamsLast30 / 10),
    followers: 0, // TODO: Implement real follower tracking
  });
}));

// ===========================================
// RELEASES
// ===========================================

// Get all releases for current user
router.get('/releases', asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

  const where = {
    userId: req.user.id,
    ...(status && { status }),
  };

  const [releases, total] = await Promise.all([
    prisma.release.findMany({
      where,
      include: {
        tracks: {
          select: {
            id: true,
            title: true,
            trackNumber: true,
            durationMs: true,
            isrc: true,
            status: true,
            audioUrl: true,
          },
          orderBy: { trackNumber: 'asc' },
        },
        artistProfile: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.release.count({ where }),
  ]);

  // Matches frontend's PaginatedResponse<Release> = {data, total, page, limit, totalPages}
  res.json({
    data: releases.map((r) => ({ ...r, artistName: r.artistProfile?.name })),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 0,
  });
}));

// Get single release
router.get('/releases/:id', asyncHandler(async (req, res) => {
  const release = await prisma.release.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id,
    },
    include: {
      tracks: {
        include: {
          contributors: true,
        },
        orderBy: { trackNumber: 'asc' },
      },
      artistProfile: true,
      label: true,
    },
  });

  if (!release) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Release not found',
    });
  }

  // Matches frontend's `api.get<Release>('/artist/releases/:id')` contract.
  res.json({ ...release, artistName: release.artistProfile?.name });
}));

// Create new release
router.post('/releases', validate(createReleaseSchema), asyncHandler(async (req, res) => {
  const {
    title, version, releaseType, genre, subgenre, language,
    releaseDate, originalReleaseDate, upc, catalogNumber,
    cLineYear, cLineText, pLineYear, pLineText,
    isExplicit, selectedStores, territories, coverArtKey,
    tracks, artistProfileId, labelId,
  } = req.body;

  // Verify artist profile belongs to user
  if (artistProfileId) {
    const profile = await prisma.artistProfile.findFirst({
      where: { id: artistProfileId, userId: req.user.id },
    });
    if (!profile) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid artist profile',
      });
    }
  }

  // Check subscription limits
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
  });

  // Create release with tracks
  const release = await prisma.release.create({
    data: {
      userId: req.user.id,
      artistProfileId,
      labelId,
      title,
      version,
      releaseType,
      genre,
      subgenre,
      language,
      releaseDate: new Date(releaseDate),
      originalReleaseDate: originalReleaseDate ? new Date(originalReleaseDate) : null,
      upc,
      catalogNumber,
      cLineYear,
      cLineText,
      pLineYear,
      pLineText,
      isExplicit,
      selectedStores,
      territories,
      coverArtKey,
      status: 'DRAFT',
      tracks: {
        create: tracks.map((track, index) => ({
          title: track.title,
          version: track.version,
          trackNumber: track.trackNumber || index + 1,
          discNumber: track.discNumber || 1,
          isrc: track.isrc,
          isExplicit: track.isExplicit || false,
          lyrics: track.lyrics,
          lyricsLanguage: track.lyricsLanguage,
          audioKey: track.audioKey,
          status: 'PROCESSING',
          ...(track.contributors && track.contributors.length > 0 && {
            contributors: {
              create: track.contributors.map((c) => ({
                name: c.name,
                role: c.role,
                royaltyPercentage: c.royaltyPercentage ?? 0,
                ipiNumber: c.ipiNumber,
              })),
            },
          }),
        })),
      },
    },
    include: {
      tracks: true,
      artistProfile: { select: { name: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'RELEASE_CREATED',
      entityType: 'Release',
      entityId: release.id,
      newValues: { title, releaseType, trackCount: tracks.length },
      ipAddress: req.ip,
    },
  });

  // Matches frontend's `api.post<Release>('/artist/releases', ...)` contract.
  res.status(201).json({ ...release, artistName: release.artistProfile?.name });
}));

// Update release
router.patch('/releases/:id', validate(updateReleaseSchema), asyncHandler(async (req, res) => {
  const release = await prisma.release.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id,
    },
  });

  if (!release) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Release not found',
    });
  }

  // Only allow editing if in DRAFT or REJECTED status
  if (!['DRAFT', 'REJECTED'].includes(release.status)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Cannot edit release in current status',
    });
  }

  const {
    title, version, releaseType, genre, subgenre, language,
    releaseDate, originalReleaseDate, upc, catalogNumber,
    cLineYear, cLineText, pLineYear, pLineText,
    isExplicit, selectedStores, territories, coverArtKey,
    tracks, status,
  } = req.body;

  const updatedRelease = await prisma.release.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(version !== undefined && { version }),
      ...(releaseType && { releaseType }),
      ...(genre && { genre }),
      ...(subgenre !== undefined && { subgenre }),
      ...(language && { language }),
      ...(releaseDate && { releaseDate: new Date(releaseDate) }),
      ...(originalReleaseDate !== undefined && { originalReleaseDate: originalReleaseDate ? new Date(originalReleaseDate) : null }),
      ...(upc !== undefined && { upc }),
      ...(catalogNumber !== undefined && { catalogNumber }),
      ...(cLineYear !== undefined && { cLineYear }),
      ...(cLineText !== undefined && { cLineText }),
      ...(pLineYear !== undefined && { pLineYear }),
      ...(pLineText !== undefined && { pLineText }),
      ...(isExplicit !== undefined && { isExplicit }),
      ...(selectedStores && { selectedStores }),
      ...(territories && { territories }),
      ...(coverArtKey !== undefined && { coverArtKey }),
      ...(status && { status }),
    },
    include: {
      tracks: true,
      artistProfile: { select: { name: true } },
    },
  });

  // Matches frontend's `api.patch<Release>('/artist/releases/:id', ...)` contract.
  res.json({ ...updatedRelease, artistName: updatedRelease.artistProfile?.name });
}));

// Submit release for review
router.post('/releases/:id/submit', validate(submitReleaseSchema), asyncHandler(async (req, res) => {
  const release = await prisma.release.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id,
    },
    include: { tracks: true },
  });

  if (!release) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Release not found',
    });
  }

  if (release.status !== 'DRAFT') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Release has already been submitted',
    });
  }

  // Validate release has required data
  if (release.tracks.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Release must have at least one track',
    });
  }

  if (!release.coverArtUrl && !release.coverArtKey) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Release must have cover artwork',
    });
  }

  // Submit for review
  const updatedRelease = await prisma.release.update({
    where: { id: req.params.id },
    data: {
      status: 'PENDING',
      submittedAt: new Date(),
    },
    include: { tracks: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'RELEASE_SUBMITTED',
      entityType: 'Release',
      entityId: release.id,
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: 'Release submitted for review',
    release: updatedRelease,
  });

  // Fire-and-forget notification to n8n (REVIEWER role alert). Intentionally
  // not awaited - never blocks the response above, and no-ops safely if
  // n8n isn't configured/reachable.
  notifyN8n('release-submitted', {
    releaseId: updatedRelease.id,
    userId: req.user.id,
    title: updatedRelease.title,
    submittedAt: updatedRelease.submittedAt,
  });
}));

// Delete release (only drafts)
router.delete('/releases/:id', asyncHandler(async (req, res) => {
  const release = await prisma.release.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id,
    },
  });

  if (!release) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Release not found',
    });
  }

  if (release.status !== 'DRAFT') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Only draft releases can be deleted',
    });
  }

  await prisma.release.delete({
    where: { id: req.params.id },
  });

  res.json({
    success: true,
    message: 'Release deleted successfully',
  });
}));

// ===========================================
// ARTIST PROFILES
// ===========================================
router.get('/profiles', asyncHandler(async (req, res) => {
  const profiles = await prisma.artistProfile.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  // Matches frontend's `api.get<Array<{id,name,avatarUrl,isVerified}>>('/artist/profiles')` contract.
  res.json(profiles);
}));

router.post('/profiles', asyncHandler(async (req, res) => {
  const { name, bio, socialLinks } = req.body;

  // Check subscription limit
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
  });

  const profileCount = await prisma.artistProfile.count({
    where: { userId: req.user.id },
  });

  if (profileCount >= (subscription?.maxArtistProfiles || 1)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You have reached the maximum number of artist profiles for your plan',
    });
  }

  const profile = await prisma.artistProfile.create({
    data: {
      userId: req.user.id,
      name,
      bio,
      socialLinks: socialLinks || {},
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
    },
  });

  // Matches frontend's `api.post<{id, name}>('/artist/profiles', ...)` contract.
  res.status(201).json(profile);
}));

router.patch('/profiles/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.artistProfile.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!existing) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Artist profile not found',
    });
  }

  const { name, bio, socialLinks, avatarUrl } = req.body;

  const profile = await prisma.artistProfile.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(bio !== undefined && { bio }),
      ...(socialLinks !== undefined && { socialLinks }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
  });

  res.json({
    success: true,
    message: 'Artist profile updated',
    profile,
  });
}));

// ===========================================
// ANALYTICS
// ===========================================
router.get('/analytics/overview', asyncHandler(async (req, res) => {
  const { period = '28d' } = req.query;

  // Calculate date range
  const endDate = new Date();
  let startDate = new Date();

  switch (period) {
    case '24h':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '28d':
      startDate.setDate(startDate.getDate() - 28);
      break;
    case 'ytd':
      startDate = new Date(endDate.getFullYear(), 0, 1);
      break;
    case 'all':
      startDate = new Date(2020, 0, 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 28);
  }

  // Get streaming stats
  const stats = await prisma.streamingStat.groupBy({
    by: ['date'],
    where: {
      track: { release: { userId: req.user.id } },
      date: { gte: startDate, lte: endDate },
    },
    _sum: {
      streams: true,
      saves: true,
      playlistAdds: true,
      revenueNet: true,
    },
    orderBy: { date: 'asc' },
  });

  // Get top tracks
  const topTracks = await prisma.streamingStat.groupBy({
    by: ['trackId'],
    where: {
      track: { release: { userId: req.user.id } },
      date: { gte: startDate },
    },
    _sum: { streams: true, revenueNet: true },
    orderBy: { _sum: { streams: 'desc' } },
    take: 10,
  });

  // Get track details
  const trackIds = topTracks.map(t => t.trackId);
  const tracks = await prisma.track.findMany({
    where: { id: { in: trackIds } },
    include: { release: { select: { title: true, coverArtUrl: true } } },
  });

  const topTracksWithDetails = topTracks.map(t => {
    const track = tracks.find(tr => tr.id === t.trackId);
    return {
      ...t,
      track,
    };
  });

  // Get streams by country
  const countryStats = await prisma.streamingStat.groupBy({
    by: ['countryCode'],
    where: {
      track: { release: { userId: req.user.id } },
      date: { gte: startDate, lte: endDate },
      countryCode: { not: null },
    },
    _sum: { streams: true },
    orderBy: { _sum: { streams: 'desc' } },
    take: 10,
  });

  const totalCountryStreams = countryStats.reduce((sum, c) => sum + Number(c._sum.streams || 0), 0);
  const countryBreakdown = countryStats.map(c => ({
    countryCode: c.countryCode,
    streams: Number(c._sum.streams || 0),
    percent: totalCountryStreams > 0
      ? Number(((Number(c._sum.streams || 0) / totalCountryStreams) * 100).toFixed(1))
      : 0,
  }));

  const totalStreams = stats.reduce((sum, s) => sum + Number(s._sum.streams || 0), 0);
  const totalRevenue = stats.reduce((sum, s) => sum + Number(s._sum.revenueNet || 0), 0);

  res.json({
    // Matches frontend's `{streams, revenue, topCountries: [{country, streams}]}` contract.
    streams: totalStreams,
    revenue: totalRevenue,
    topCountries: countryBreakdown.map((c) => ({ country: c.countryCode, streams: c.streams })),
    // Bonus fields for richer dashboard widgets.
    period,
    dailyStats: stats,
    topTracks: topTracksWithDetails,
    countryBreakdown,
    totals: {
      streams: totalStreams,
      revenue: totalRevenue,
      saves: stats.reduce((sum, s) => sum + Number(s._sum.saves || 0), 0),
      playlistAdds: stats.reduce((sum, s) => sum + Number(s._sum.playlistAdds || 0), 0),
    },
  });
}));

// ===========================================
// WALLET
// ===========================================
router.get('/wallet', asyncHandler(async (req, res) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId: req.user.id },
  });

  const recentPayouts = await prisma.payout.findMany({
    where: { userId: req.user.id },
    orderBy: { requestedAt: 'desc' },
    take: 10,
  });

  const pendingRoyalties = await prisma.royalty.aggregate({
    where: {
      userId: req.user.id,
      status: 'pending',
    },
    _sum: { netRevenue: true },
  });

  // Matches frontend's Wallet shape at top level: {availableBalance,
  // pendingBalance, lifetimeEarnings, currency, minPayoutThreshold}.
  res.json({
    availableBalance: wallet?.availableBalance || 0,
    pendingBalance: wallet?.pendingBalance || 0,
    lifetimeEarnings: wallet?.lifetimeEarnings || 0,
    currency: wallet?.currency || 'USD',
    minPayoutThreshold: wallet?.minPayoutThreshold || 50,
    // Bonus fields.
    recentPayouts,
    pendingRoyalties: pendingRoyalties._sum.netRevenue || 0,
  });
}));

router.post('/wallet/request-payout', asyncHandler(async (req, res) => {
  const { amount, method, methodDetails } = req.body;

  const wallet = await prisma.wallet.findUnique({
    where: { userId: req.user.id },
  });

  if (!wallet) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Wallet not found',
    });
  }

  if (amount > Number(wallet.availableBalance)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Insufficient balance',
    });
  }

  if (amount < Number(wallet.minPayoutThreshold)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Minimum payout amount is $${wallet.minPayoutThreshold}`,
    });
  }

  // Create payout request
  const payout = await prisma.$transaction(async (tx) => {
    // Deduct from available balance
    await tx.wallet.update({
      where: { userId: req.user.id },
      data: {
        availableBalance: { decrement: amount },
      },
    });

    // Create payout record
    return tx.payout.create({
      data: {
        userId: req.user.id,
        walletId: wallet.id,
        amount,
        method,
        methodDetails,
        status: 'PENDING',
      },
    });
  });

  // Matches frontend's `api.post<{success, payoutId}>('/artist/wallet/request-payout', ...)` contract.
  res.status(201).json({
    success: true,
    payoutId: payout.id,
    message: 'Payout request submitted',
    payout,
  });

  // Fire-and-forget notification to n8n (FINANCE role alert). Intentionally
  // not awaited - never blocks the response above, and no-ops safely if
  // n8n isn't configured/reachable.
  notifyN8n('payout-requested', {
    payoutId: payout.id,
    userId: req.user.id,
    amount: payout.amount,
    currency: wallet.currency || 'USD',
    requestedAt: payout.requestedAt,
  });
}));

router.get('/wallet/transactions', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  // Get royalties as incoming transactions
  const royalties = await prisma.royalty.findMany({
    where: { userId: req.user.id, status: 'cleared' },
    include: {
      dsp: { select: { name: true } },
      release: { select: { title: true } },
    },
    orderBy: { processedAt: 'desc' },
    take: parseInt(limit),
  });

  // Get payouts as outgoing transactions
  const payouts = await prisma.payout.findMany({
    where: { userId: req.user.id },
    orderBy: { requestedAt: 'desc' },
    take: parseInt(limit),
  });

  // Combine and sort
  const transactions = [
    ...royalties.map(r => ({
      id: r.id,
      type: 'royalty',
      description: `Royalty - ${r.release?.title || 'Unknown'}`,
      source: r.dsp?.name || 'Platform',
      amount: Number(r.netRevenue),
      date: r.processedAt || r.createdAt,
      status: 'cleared',
    })),
    ...payouts.map(p => ({
      id: p.id,
      type: 'payout',
      description: 'Payout',
      method: p.method,
      amount: -Number(p.amount),
      date: p.requestedAt,
      status: p.status.toLowerCase(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({ transactions });
}));

// ===========================================
// SUPPORT
// ===========================================
router.get('/tickets', asyncHandler(async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user.id },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Matches frontend's `api.get<SupportTicket[]>('/artist/tickets')` contract.
  res.json(tickets);
}));

router.post('/tickets', asyncHandler(async (req, res) => {
  const { subject, category, priority, message } = req.body;

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user.id,
      subject,
      category,
      ...(priority && { priority: priority.toLowerCase() }),
      messages: {
        create: {
          userId: req.user.id,
          message,
        },
      },
    },
    include: { messages: true },
  });

  // Matches frontend's `api.post<SupportTicket>('/artist/tickets', ...)` contract.
  res.status(201).json(ticket);
}));

router.post('/tickets/:id/reply', asyncHandler(async (req, res) => {
  const { message } = req.body;

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id,
    },
  });

  if (!ticket) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Ticket not found',
    });
  }

  // NOTE: model is `SupportTicketMessage` (see prisma/schema.prisma), not
  // `TicketMessage` - `prisma.ticketMessage` does not exist and would throw.
  const newMessage = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      userId: req.user.id,
      message,
    },
  });

  // Update ticket status if closed
  if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'OPEN' },
    });
  }

  // Matches frontend's `api.post<{success}>('/artist/tickets/:id/reply', ...)`
  // contract. Field renamed from `message` (a string elsewhere in this API)
  // to `ticketMessage` to avoid the ambiguity of `message` holding an object.
  res.status(201).json({
    success: true,
    ticketMessage: newMessage,
  });
}));

router.patch('/profile', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { name },
  });
  res.json({ success: true, user: updatedUser });
}));

export default router;
