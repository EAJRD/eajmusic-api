import { z } from 'zod';

export const moneySchema = z.number().finite().positive().max(9999999999.99)
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use at most two decimal places');
const requestSchema = z.object({
  amount: moneySchema,
  method: z.enum(['paypal', 'bank_transfer', 'wire', 'check', 'crypto', 'wise', 'payoneer', 'ath_movil']),
  methodDetails: z.record(z.unknown()),
  idempotencyKey: z.string().trim().min(1).max(100),
});
const importSchema = z.object({
  email: z.string().email().transform(value => value.toLowerCase()),
  amount: z.union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)]).pipe(moneySchema),
  method: z.string().transform(value => value.toLowerCase()).pipe(requestSchema.shape.method),
  transactionId: z.string().trim().min(1).max(255),
});
const processSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('COMPLETE'), transactionId: z.string().trim().min(1).max(255) }),
  z.object({ action: z.literal('FAIL'), failureReason: z.string().trim().min(1).max(1000) }),
]);
export const conflict = message => Object.assign(new Error(message), { statusCode: 409 });
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

// Retry only rolled-back database transactions; never put provider calls here.
export async function serialTransaction(db, operation) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await db.$transaction(operation, { isolationLevel: 'Serializable' }); }
    catch (error) {
      if (error.code !== 'P2034' && error.code !== 'P2002') throw error;
      if (attempt === 2) throw conflict('Concurrent change; retry with the same idempotency key');
    }
  }
}

export async function requestPayout(db, userId, input) {
  const data = requestSchema.parse(input);
  return serialTransaction(db, async tx => {
    const existing = await tx.payout.findFirst({ where: { userId, idempotencyKey: data.idempotencyKey } });
    if (existing) {
      if (Number(existing.amount) !== data.amount || existing.method !== data.method || JSON.stringify(canonical(existing.methodDetails)) !== JSON.stringify(canonical(data.methodDetails))) {
        throw conflict('Idempotency key was already used with different payout details');
      }
      return existing;
    }
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    if (data.amount < Number(wallet.minPayoutThreshold)) throw Object.assign(new Error('Amount is below the minimum payout'), { statusCode: 400 });
    const reserved = await tx.wallet.updateMany({
      where: { id: wallet.id, availableBalance: { gte: data.amount } },
      data: { availableBalance: { decrement: data.amount } },
    });
    if (reserved.count !== 1) throw conflict('Insufficient balance');
    return tx.payout.create({ data: { ...data, userId, walletId: wallet.id, currency: wallet.currency, status: 'PENDING' } });
  });
}

export async function processPayout(db, payoutId, input) {
  const decision = processSchema.parse(input);
  const status = decision.action === 'COMPLETE' ? 'COMPLETED' : 'FAILED';
  return serialTransaction(db, async tx => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw Object.assign(new Error('Payout not found'), { statusCode: 404 });
    if (payout.status === status) {
      if (status === 'COMPLETED' && payout.transactionId !== decision.transactionId) throw conflict('Different payment receipt');
      return payout;
    }
    if (payout.status !== 'PENDING') throw conflict('Payout is no longer pending');
    const { action, ...details } = decision;
    const changed = await tx.payout.updateMany({ where: { id: payoutId, status: 'PENDING' }, data: { ...details, status, processedAt: new Date() } });
    if (changed.count !== 1) throw conflict('Payout was already processed');
    if (status === 'FAILED') await tx.wallet.update({ where: { id: payout.walletId }, data: { availableBalance: { increment: payout.amount } } });
    return tx.payout.findUnique({ where: { id: payoutId } });
  });
}

export async function importCompletedPayout(db, input, actorId) {
  const record = importSchema.parse(input);
  return serialTransaction(db, async tx => {
    const user = await tx.user.findUnique({ where: { email: record.email }, include: { wallet: true } });
    if (!user?.wallet) throw Object.assign(new Error('User wallet not found'), { statusCode: 404 });
    const receipt = await tx.payout.findFirst({ where: { method: record.method, transactionId: record.transactionId } });
    if (receipt) {
      if (receipt.userId !== user.id || Number(receipt.amount) !== record.amount || receipt.status !== 'COMPLETED') throw conflict('Payment receipt has different payout details');
      return receipt;
    }
    const pending = await tx.payout.findFirst({ where: { userId: user.id, amount: record.amount, method: record.method, status: 'PENDING' }, orderBy: { requestedAt: 'asc' } });
    let payout;
    if (pending) {
      const changed = await tx.payout.updateMany({ where: { id: pending.id, status: 'PENDING' }, data: { status: 'COMPLETED', processedAt: new Date(), transactionId: record.transactionId } });
      if (changed.count !== 1) throw conflict('Payout was processed concurrently');
      payout = await tx.payout.findUnique({ where: { id: pending.id } });
    } else {
      // Historical reconciliation only: this path does not initiate a payment
      // or reserve money. The external receipt is its durable idempotency key.
      payout = await tx.payout.create({ data: {
        userId: user.id, walletId: user.wallet.id, amount: record.amount, currency: user.wallet.currency,
        method: record.method, transactionId: record.transactionId, methodDetails: { source: 'csv_import' },
        status: 'COMPLETED', processedAt: new Date(),
      } });
    }
    await tx.auditLog.create({ data: { userId: actorId, action: 'PAYOUT_BULK_COMPLETED', entityType: 'Payout', entityId: payout.id, newValues: record } });
    return payout;
  });
}
