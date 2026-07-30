import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import athMovilService from '../services/athMovilService.js';

const router = Router();
const prisma = new PrismaClient();

// ===========================================
// ATH MÓVIL PAYMENT INITIATION
// ===========================================
router.post('/ath-movil/initiate', authenticate, asyncHandler(async (req, res) => {
  const { amount, description, type } = req.body; // type: 'subscription' | 'other'

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid amount is required' });
  }

  // Check if ATH Móvil is enabled
  const athConfig = await prisma.platformSetting.findUnique({ where: { key: 'ath_movil_enabled' } });
  if (!athConfig?.value || athConfig.value === false) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'ATH Móvil payments are not currently enabled.' });
  }

  const referenceId = `EAJ-${Date.now()}`;

  let paymentResult;
  if (athMovilService.isConfigured()) {
    paymentResult = await athMovilService.createPayment({
      amount,
      description: description || 'EAJMUSIC Payment',
      referenceId,
    });
  } else {
    paymentResult = athMovilService.createMockPayment({
      amount,
      description: description || 'EAJMUSIC Payment',
      referenceId,
    });
  }

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
  // TODO: confirm against ATH Móvil's actual webhook signature docs.
  // ATH Móvil's Business API has no documented request-signing scheme in
  // this codebase (no signature header, no HMAC secret) - athMovilService's
  // PUBLIC_TOKEN/PRIVATE_TOKEN are only used for *outbound* calls to ATH
  // Móvil, not for verifying *inbound* webhook authenticity. As a stopgap
  // until real docs/credentials are available, require a shared secret
  // (configured with ATH Móvil as part of the callback URL, since many
  // simple webhook integrations don't support custom headers) so this
  // endpoint isn't wide open to anyone who discovers the URL. If the secret
  // isn't configured, the check is skipped (fails open) rather than
  // breaking an already-working integration silently.
  const expectedSecret = process.env.ATH_MOVIL_WEBHOOK_SECRET;
  if (expectedSecret) {
    const providedSecret = req.query.secret || req.get('X-Webhook-Secret');
    if (providedSecret !== expectedSecret) {
      console.error('[ATH_MOVIL WEBHOOK] Rejected: invalid or missing shared secret');
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    console.warn('[ATH_MOVIL WEBHOOK] ATH_MOVIL_WEBHOOK_SECRET is not set - webhook authenticity is NOT verified.');
  }

  const webhookData = athMovilService.processWebhook(req.body);

  if (!webhookData.internalReferenceId) {
    return res.status(400).json({ error: 'Invalid webhook data' });
  }

  // Find the transaction
  const transaction = await prisma.paymentTransaction.findFirst({
    where: {
      provider: 'ATH_MOVIL',
      metadata: { path: ['referenceId'], equals: webhookData.internalReferenceId },
    },
  });

  if (!transaction) {
    console.error('[ATH_MOVIL WEBHOOK] Transaction not found:', webhookData.internalReferenceId);
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Update transaction status
  const newStatus = webhookData.success ? 'COMPLETED' : 'FAILED';
  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: newStatus,
      externalId: webhookData.referenceNumber || transaction.externalId,
      completedAt: webhookData.success ? new Date() : null,
      metadata: {
        ...transaction.metadata,
        webhookResponse: webhookData,
      },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: transaction.userId,
      action: webhookData.success ? 'ATH_MOVIL_PAYMENT_COMPLETED' : 'ATH_MOVIL_PAYMENT_FAILED',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      newValues: webhookData,
    },
  });

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
