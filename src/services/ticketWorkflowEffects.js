// ===========================================
// TICKET WORKFLOW SIDE EFFECTS
// ===========================================
// The point of the workflow machinery: a state change is not a note on a
// thread, it performs the actual backend operation. Each function here is
// the real work behind one `effect` named in src/utils/ticketWorkflow.js.
//
// Contract every handler follows:
//  - Receives the SAME Prisma transaction client as the state change, so the
//    ticket never advances without its effect landing, and vice versa.
//  - Throws WorkflowEffectError on anything the operator can fix (missing
//    link, insufficient balance). The route maps that to a 4xx; anything
//    else bubbles as a 500 and rolls the transaction back.
//  - Returns a small object merged into the workflow event's audit record.

export class WorkflowEffectError extends Error {
  constructor(message, code = 'EFFECT_FAILED') {
    super(message);
    this.name = 'WorkflowEffectError';
    this.code = code;
    this.statusCode = 400;
  }
}

function requireRelease(ticket) {
  if (!ticket.relatedReleaseId) {
    throw new WorkflowEffectError(
      'Este ticket no tiene un release asociado. Vincúlalo antes de ejecutar esta acción.',
      'NO_RELATED_RELEASE'
    );
  }
  return ticket.relatedReleaseId;
}

/**
 * Pause distribution while a claim is examined. Remembers the status it came
 * from so lifting the hold restores exactly that, rather than assuming LIVE.
 */
async function holdRelease(tx, ticket) {
  const releaseId = requireRelease(ticket);
  const release = await tx.release.findUnique({
    where: { id: releaseId },
    select: { id: true, status: true },
  });
  if (!release) {
    throw new WorkflowEffectError('El release asociado ya no existe.', 'RELEASE_NOT_FOUND');
  }
  if (release.status === 'HELD') {
    throw new WorkflowEffectError('El release ya está retenido.', 'ALREADY_HELD');
  }

  await tx.release.update({
    where: { id: releaseId },
    data: { status: 'HELD', statusBeforeHold: release.status },
  });

  return { releaseId, previousStatus: release.status, newStatus: 'HELD' };
}

/** Lift a hold, putting the release back exactly where it was. */
async function restoreRelease(tx, ticket) {
  const releaseId = requireRelease(ticket);
  const release = await tx.release.findUnique({
    where: { id: releaseId },
    select: { id: true, status: true, statusBeforeHold: true },
  });
  if (!release) {
    throw new WorkflowEffectError('El release asociado ya no existe.', 'RELEASE_NOT_FOUND');
  }

  // Falls back to LIVE only if the hold predates statusBeforeHold existing.
  const restoreTo = release.statusBeforeHold || 'LIVE';

  await tx.release.update({
    where: { id: releaseId },
    data: { status: restoreTo, statusBeforeHold: null },
  });

  return { releaseId, previousStatus: release.status, newStatus: restoreTo };
}

/** Permanent removal. Terminal for the release, unlike a hold. */
async function takedownRelease(tx, ticket) {
  const releaseId = requireRelease(ticket);
  const release = await tx.release.findUnique({
    where: { id: releaseId },
    select: { id: true, status: true },
  });
  if (!release) {
    throw new WorkflowEffectError('El release asociado ya no existe.', 'RELEASE_NOT_FOUND');
  }

  await tx.release.update({
    where: { id: releaseId },
    data: { status: 'TAKEDOWN', statusBeforeHold: null },
  });

  return { releaseId, previousStatus: release.status, newStatus: 'TAKEDOWN' };
}

/**
 * Move a wallet's available balance into pending, so a disputed royalty
 * cannot be withdrawn while it is under review. Deliberately does not
 * destroy the money - a hold is reversible, and RELEASE_ROYALTIES undoes it.
 */
async function holdRoyalties(tx, ticket, { amount }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new WorkflowEffectError('Indica un monto válido a retener.', 'INVALID_AMOUNT');
  }

  const wallet = await tx.wallet.findUnique({ where: { userId: ticket.userId } });
  if (!wallet) {
    throw new WorkflowEffectError('Este usuario no tiene wallet.', 'NO_WALLET');
  }
  if (Number(wallet.availableBalance) < value) {
    throw new WorkflowEffectError(
      `Saldo disponible insuficiente para retener $${value.toFixed(2)} (disponible: $${Number(wallet.availableBalance).toFixed(2)}).`,
      'INSUFFICIENT_AVAILABLE'
    );
  }

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      availableBalance: { decrement: value },
      pendingBalance: { increment: value },
    },
  });

  return { walletId: wallet.id, heldAmount: value };
}

/** Undo a hold: pending back to available. */
async function releaseRoyalties(tx, ticket, { amount }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new WorkflowEffectError('Indica un monto válido a liberar.', 'INVALID_AMOUNT');
  }

  const wallet = await tx.wallet.findUnique({ where: { userId: ticket.userId } });
  if (!wallet) {
    throw new WorkflowEffectError('Este usuario no tiene wallet.', 'NO_WALLET');
  }
  if (Number(wallet.pendingBalance) < value) {
    throw new WorkflowEffectError(
      `Saldo retenido insuficiente para liberar $${value.toFixed(2)} (retenido: $${Number(wallet.pendingBalance).toFixed(2)}).`,
      'INSUFFICIENT_PENDING'
    );
  }

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      pendingBalance: { decrement: value },
      availableBalance: { increment: value },
    },
  });

  return { walletId: wallet.id, releasedAmount: value };
}

/**
 * Put a failed payout back in the queue. Does not itself contact the payment
 * provider - it returns the record to PENDING so the normal payout
 * processing path picks it up again.
 */
async function retryPayout(tx, ticket) {
  if (!ticket.relatedPayoutId) {
    throw new WorkflowEffectError(
      'Este ticket no tiene un payout asociado. Vincúlalo antes de reintentar.',
      'NO_RELATED_PAYOUT'
    );
  }

  const payout = await tx.payout.findUnique({
    where: { id: ticket.relatedPayoutId },
    select: { id: true, status: true },
  });
  if (!payout) {
    throw new WorkflowEffectError('El payout asociado ya no existe.', 'PAYOUT_NOT_FOUND');
  }
  if (payout.status !== 'FAILED') {
    throw new WorkflowEffectError(
      `Solo se puede reintentar un payout FAILED (estado actual: ${payout.status}).`,
      'PAYOUT_NOT_FAILED'
    );
  }

  await tx.payout.update({
    where: { id: payout.id },
    data: { status: 'PENDING', failureReason: null },
  });

  return { payoutId: payout.id, previousStatus: payout.status, newStatus: 'PENDING' };
}

/**
 * Opens a FinancialReversal in PENDING. Note what this does NOT do: it does
 * not touch the wallet. A reversal only moves money once a SECOND person
 * approves it (POST /admin/reversals/:id/approve) - that is the whole point
 * of routing money-back through this model instead of a wallet adjustment.
 */
async function openReversal(tx, ticket, { amount, note, actorId }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new WorkflowEffectError('Indica un monto válido a revertir.', 'INVALID_AMOUNT');
  }

  const wallet = await tx.wallet.findUnique({ where: { userId: ticket.userId } });
  if (!wallet) {
    throw new WorkflowEffectError('Este usuario no tiene wallet.', 'NO_WALLET');
  }

  const reversal = await tx.financialReversal.create({
    data: {
      userId: ticket.userId,
      walletId: wallet.id,
      amount: value,
      currency: wallet.currency,
      reason: note,
      ticketId: ticket.id,
      payoutId: ticket.relatedPayoutId || null,
      requestedById: actorId,
    },
  });

  return { reversalId: reversal.id, amount: value, awaitingSecondApproval: true };
}

const EFFECT_HANDLERS = {
  HOLD_RELEASE: holdRelease,
  RESTORE_RELEASE: restoreRelease,
  TAKEDOWN_RELEASE: takedownRelease,
  HOLD_ROYALTIES: holdRoyalties,
  RELEASE_ROYALTIES: releaseRoyalties,
  RETRY_PAYOUT: retryPayout,
  OPEN_REVERSAL: openReversal,
  // EXECUTE_REVERSAL is intentionally absent: the FINANCIAL_REVERSAL
  // workflow's approval step is driven by the reversal endpoints, which own
  // the two-person check. Reaching it through a generic ticket transition
  // would bypass that, so it is not wired here.
};

export function isKnownEffect(effect) {
  return Object.hasOwn(EFFECT_HANDLERS, effect);
}

/**
 * Runs `effect` inside `tx`. Unknown effects throw rather than silently
 * no-op: a transition that claims to do something must actually do it.
 */
export async function applyEffect(effect, tx, ticket, context) {
  const handler = EFFECT_HANDLERS[effect];
  if (!handler) {
    throw new WorkflowEffectError(
      `La acción "${effect}" no puede ejecutarse desde una transición de ticket.`,
      'EFFECT_NOT_APPLICABLE'
    );
  }
  return handler(tx, ticket, context);
}
