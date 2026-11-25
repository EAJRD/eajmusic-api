import crypto from 'node:crypto';
import { z } from 'zod';
import { moneySchema, serialTransaction, conflict } from './payoutService.js';

const payloadSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED']),
  metadata2: z.string().min(1).max(255),
  referenceNumber: z.string().min(1).max(255),
  total: z.union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)]).pipe(moneySchema),
  currency: z.literal('USD').optional(),
});

export async function applyPaymentWebhook(db, body, expectedSecret, suppliedSecret) {
  if (!expectedSecret) throw Object.assign(new Error('Webhook authentication is not configured'), { statusCode: 503 });
  const expected = Buffer.from(expectedSecret);
  const supplied = Buffer.from(typeof suppliedSecret === 'string' ? suppliedSecret : '');
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    throw Object.assign(new Error('Invalid webhook authentication'), { statusCode: 403 });
  }
  const payload = payloadSchema.parse(body);
  return serialTransaction(db, async tx => {
    const transaction = await tx.paymentTransaction.findFirst({ where: { provider: 'ATH_MOVIL', metadata: { path: ['referenceId'], equals: payload.metadata2 } } });
    if (!transaction) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
    if (Number(transaction.amount) !== payload.total || transaction.currency !== 'USD') throw conflict('Payment amount or currency mismatch');
    if (transaction.status === payload.status && transaction.externalId === payload.referenceNumber) return;
    if (transaction.status !== 'PENDING') throw conflict('Payment already has a terminal outcome');
    const changed = await tx.paymentTransaction.updateMany({
      where: { id: transaction.id, status: 'PENDING' },
      data: {
        status: payload.status, externalId: payload.referenceNumber,
        completedAt: payload.status === 'COMPLETED' ? new Date() : null,
        metadata: { ...transaction.metadata, webhookResponse: payload },
      },
    });
    if (changed.count !== 1) throw conflict('Payment changed concurrently');
    await tx.auditLog.create({ data: {
      userId: transaction.userId, action: `ATH_MOVIL_PAYMENT_${payload.status}`,
      entityType: 'PaymentTransaction', entityId: transaction.id, newValues: payload,
    } });
  });
}
