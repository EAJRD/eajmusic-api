import { describe, it, expect } from 'vitest';
import { applyEffect, isKnownEffect, WorkflowEffectError } from './ticketWorkflowEffects.js';

// Minimal stand-in for a Prisma transaction client. Records every write so
// tests can assert what the effect actually did, without a database.
function fakeTx({ release, wallet, payout } = {}) {
  const writes = [];
  return {
    writes,
    release: {
      findUnique: async () => (release ? { ...release } : null),
      update: async ({ where, data }) => {
        writes.push({ model: 'release', where, data });
        return { ...release, ...data };
      },
    },
    wallet: {
      findUnique: async () => (wallet ? { ...wallet } : null),
      update: async ({ where, data }) => {
        writes.push({ model: 'wallet', where, data });
        return { ...wallet, ...data };
      },
    },
    payout: {
      findUnique: async () => (payout ? { ...payout } : null),
      update: async ({ where, data }) => {
        writes.push({ model: 'payout', where, data });
        return { ...payout, ...data };
      },
    },
    financialReversal: {
      create: async ({ data }) => {
        writes.push({ model: 'financialReversal', data });
        return { id: 'rev-1', ...data };
      },
    },
  };
}

const ticket = (overrides = {}) => ({
  id: 't-1',
  userId: 'u-1',
  relatedReleaseId: 'r-1',
  relatedPayoutId: 'p-1',
  ...overrides,
});

describe('release holds', () => {
  it('remembers the status it came from so it can be restored exactly', async () => {
    const tx = fakeTx({ release: { id: 'r-1', status: 'LIVE' } });
    const result = await applyEffect('HOLD_RELEASE', tx, ticket(), {});

    expect(result).toEqual({ releaseId: 'r-1', previousStatus: 'LIVE', newStatus: 'HELD' });
    expect(tx.writes[0].data).toEqual({ status: 'HELD', statusBeforeHold: 'LIVE' });
  });

  it('restores to the remembered status, not a guess at LIVE', async () => {
    const tx = fakeTx({ release: { id: 'r-1', status: 'HELD', statusBeforeHold: 'APPROVED' } });
    const result = await applyEffect('RESTORE_RELEASE', tx, ticket(), {});

    expect(result.newStatus).toBe('APPROVED');
    expect(tx.writes[0].data).toEqual({ status: 'APPROVED', statusBeforeHold: null });
  });

  it('falls back to LIVE only when nothing was remembered', async () => {
    const tx = fakeTx({ release: { id: 'r-1', status: 'HELD', statusBeforeHold: null } });
    const result = await applyEffect('RESTORE_RELEASE', tx, ticket(), {});
    expect(result.newStatus).toBe('LIVE');
  });

  it('refuses to hold a release twice', async () => {
    const tx = fakeTx({ release: { id: 'r-1', status: 'HELD' } });
    await expect(applyEffect('HOLD_RELEASE', tx, ticket(), {})).rejects.toMatchObject({ code: 'ALREADY_HELD' });
    expect(tx.writes).toHaveLength(0);
  });

  it('refuses to act when the ticket is not linked to a release', async () => {
    const tx = fakeTx({ release: { id: 'r-1', status: 'LIVE' } });
    await expect(
      applyEffect('HOLD_RELEASE', tx, ticket({ relatedReleaseId: null }), {})
    ).rejects.toMatchObject({ code: 'NO_RELATED_RELEASE' });
    expect(tx.writes).toHaveLength(0);
  });

  it('takedown clears any hold bookkeeping', async () => {
    const tx = fakeTx({ release: { id: 'r-1', status: 'HELD' } });
    await applyEffect('TAKEDOWN_RELEASE', tx, ticket(), {});
    expect(tx.writes[0].data).toEqual({ status: 'TAKEDOWN', statusBeforeHold: null });
  });
});

describe('royalty holds move money between buckets, never destroy it', () => {
  it('moves available into pending', async () => {
    const tx = fakeTx({ wallet: { id: 'w-1', availableBalance: 100, pendingBalance: 0 } });
    const result = await applyEffect('HOLD_ROYALTIES', tx, ticket(), { amount: 40 });

    expect(result).toEqual({ walletId: 'w-1', heldAmount: 40 });
    expect(tx.writes[0].data).toEqual({
      availableBalance: { decrement: 40 },
      pendingBalance: { increment: 40 },
    });
  });

  it('moves pending back into available', async () => {
    const tx = fakeTx({ wallet: { id: 'w-1', availableBalance: 60, pendingBalance: 40 } });
    await applyEffect('RELEASE_ROYALTIES', tx, ticket(), { amount: 40 });

    expect(tx.writes[0].data).toEqual({
      pendingBalance: { decrement: 40 },
      availableBalance: { increment: 40 },
    });
  });

  it('cannot hold more than is available', async () => {
    const tx = fakeTx({ wallet: { id: 'w-1', availableBalance: 10, pendingBalance: 0 } });
    await expect(applyEffect('HOLD_ROYALTIES', tx, ticket(), { amount: 40 })).rejects.toMatchObject({
      code: 'INSUFFICIENT_AVAILABLE',
    });
    expect(tx.writes).toHaveLength(0);
  });

  it('cannot release more than is held', async () => {
    const tx = fakeTx({ wallet: { id: 'w-1', availableBalance: 100, pendingBalance: 5 } });
    await expect(applyEffect('RELEASE_ROYALTIES', tx, ticket(), { amount: 40 })).rejects.toMatchObject({
      code: 'INSUFFICIENT_PENDING',
    });
    expect(tx.writes).toHaveLength(0);
  });

  it.each([0, -5, 'abc', null, undefined, NaN])('rejects a %s amount', async (amount) => {
    const tx = fakeTx({ wallet: { id: 'w-1', availableBalance: 100, pendingBalance: 100 } });
    await expect(applyEffect('HOLD_ROYALTIES', tx, ticket(), { amount })).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    });
    expect(tx.writes).toHaveLength(0);
  });
});

describe('payout retry', () => {
  it('returns a failed payout to the queue', async () => {
    const tx = fakeTx({ payout: { id: 'p-1', status: 'FAILED' } });
    const result = await applyEffect('RETRY_PAYOUT', tx, ticket(), {});

    expect(result.newStatus).toBe('PENDING');
    expect(tx.writes[0].data).toEqual({ status: 'PENDING', failureReason: null });
  });

  it.each(['PENDING', 'PROCESSING', 'COMPLETED'])('refuses to retry a %s payout', async (status) => {
    const tx = fakeTx({ payout: { id: 'p-1', status } });
    await expect(applyEffect('RETRY_PAYOUT', tx, ticket(), {})).rejects.toMatchObject({
      code: 'PAYOUT_NOT_FAILED',
    });
    expect(tx.writes).toHaveLength(0);
  });
});

describe('opening a reversal', () => {
  it('creates a PENDING request and does NOT touch the wallet', async () => {
    const tx = fakeTx({ wallet: { id: 'w-1', availableBalance: 100, currency: 'USD' } });
    const result = await applyEffect('OPEN_REVERSAL', tx, ticket(), {
      amount: 25,
      note: 'cobro duplicado',
      actorId: 'finance-1',
    });

    expect(result.awaitingSecondApproval).toBe(true);
    // The whole point: requesting a reversal moves no money.
    expect(tx.writes.filter((w) => w.model === 'wallet')).toHaveLength(0);

    const created = tx.writes.find((w) => w.model === 'financialReversal');
    expect(created.data).toMatchObject({
      userId: 'u-1',
      amount: 25,
      requestedById: 'finance-1',
      ticketId: 't-1',
    });
    // No approver is set at request time - that is the second person's job.
    expect(created.data.approvedById).toBeUndefined();
  });
});

describe('effect registry', () => {
  it('does not expose EXECUTE_REVERSAL as a ticket transition', () => {
    // Executing a reversal must go through POST /admin/reversals/:id/approve,
    // which owns the two-person check. Reaching it via a generic ticket
    // transition would bypass that.
    expect(isKnownEffect('EXECUTE_REVERSAL')).toBe(false);

    const tx = fakeTx({});
    return expect(applyEffect('EXECUTE_REVERSAL', tx, ticket(), {})).rejects.toMatchObject({
      code: 'EFFECT_NOT_APPLICABLE',
    });
  });

  it('throws rather than silently no-opping on an unknown effect', async () => {
    const tx = fakeTx({});
    await expect(applyEffect('MADE_UP', tx, ticket(), {})).rejects.toBeInstanceOf(WorkflowEffectError);
    expect(tx.writes).toHaveLength(0);
  });

  it('knows the effects the state machine actually declares', () => {
    for (const effect of [
      'HOLD_RELEASE',
      'RESTORE_RELEASE',
      'TAKEDOWN_RELEASE',
      'HOLD_ROYALTIES',
      'RELEASE_ROYALTIES',
      'RETRY_PAYOUT',
      'OPEN_REVERSAL',
    ]) {
      expect(isKnownEffect(effect), effect).toBe(true);
    }
  });
});
