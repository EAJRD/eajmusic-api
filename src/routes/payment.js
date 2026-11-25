import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import athMovilService from '../services/athMovilService.js';

import crypto from 'node:crypto';
import { applyPaymentWebhook } from '../services/paymentWebhook.js';
import { moneySchema } from '../services/payoutService.js';

const router = Router();

// ===========================================
// ATH MÓVIL PAYMENT INITIATION
// ===========================================
router.post('/ath-movil/initiate', authenticate, asyncHandler(async (req, res) => {
  const { amount, description, type } = req.body; // type: 'subscription' | 'other'

  if (!moneySchema.safeParse(amount).success) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid amount is required' });
  }

  // Check if ATH Móvil is enabled
  const athConfig = await prisma.platformSetting.findUnique({ where: { key: 'ath_movil_enabled' } });
  if (!athConfig?.value || athConfig.value === false) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'ATH Móvil payments are not currently enabled.' });
  }

  const referenceId = `EAJ-${crypto.randomUUID()}`;

  if (!athMovilService.isConfigured()) return res.status(503).json({ error: 'Payment provider is not configured' });
  const paymentResult = await athMovilService.createPayment({ amount, description: description || 'EAJMUSIC Payment', referenceId });

  // Store transaction record
  const transaction = await prisma.paymentTransaction.create({
    data: {
      userId: req.user.id,
      provider: 'ATH_MOVIL',
      externalId: paymentResult.paymentId || referenceId,
      amount,
      currency: 'USD',
      status: 'PENDING',
      type: type || 'subscription',
      metadata: {
        description,
        referenceId,
        response: paymentResult,
      },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'ATH_MOVIL_PAYMENT_INITIATED',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      newValues: { amount, type },
      ipAddress: req.ip,
    },
  });

  res.status(201).json({
    success: true,
    transaction: {
      id: transaction.id,
      status: 'PENDING',
      amount,
    },
    paymentData: paymentResult,
  });
}));

// ===========================================
// ATH MÓVIL WEBHOOK / CALLBACK
// ===========================================
router.post('/ath-movil/webhook', asyncHandler(async (req, res) => {
  await applyPaymentWebhook(prisma, req.body, process.env.ATH_MOVIL_WEBHOOK_SECRET, req.get('X-Webhook-Secret'));

  res.json({ received: true });
}));

// ===========================================
// PAYMENT STATUS CHECK
// ===========================================
router.get('/ath-movil/status/:id', authenticate, asyncHandler(async (req, res) => {
  const transaction = await prisma.paymentTransaction.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id,
    },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Not Found', message: 'Transaction not found' });
  }

  res.json({
    id: transaction.id,
    status: transaction.status,
    amount: transaction.amount,
    provider: transaction.provider,
    createdAt: transaction.createdAt,
    completedAt: transaction.completedAt,
  });
}));

// ===========================================
// ATH MÓVIL CONFIGURATION STATUS (for frontend)
// ===========================================
router.get('/ath-movil/config', authenticate, asyncHandler(async (req, res) => {
  const athConfig = await prisma.platformSetting.findUnique({ where: { key: 'ath_movil_enabled' } });
  
  res.json({
    enabled: athConfig?.value === true,
    configured: athMovilService.isConfigured(),
  });
}));

export default router;
