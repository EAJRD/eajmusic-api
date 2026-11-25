import { it, expect } from 'vitest';
import { requestPayout, processPayout, importCompletedPayout } from './payoutService.js';

// Serial transactions with rollback, mirroring the boundary contract without a real DB.
function database() {
  let state = { balance: 100, payouts: [] };
  let queue = Promise.resolve();
  const tx = {
    user: { findUnique: async () => ({ id: 'u', wallet: { id: 'w', currency: 'USD' } }) },
    auditLog: { create: async () => ({}) },
    wallet: {
      findUnique: async () => ({ id: 'w', availableBalance: state.balance, minPayoutThreshold: 50, currency: 'USD' }),
      updateMany: async ({ where, data }) => {
        if (where.availableBalance && state.balance < where.availableBalance.gte) return { count: 0 };
        state.balance += (data.availableBalance.increment || 0) - (data.availableBalance.decrement || 0);
        return { count: 1 };
      },
      update: async ({ data }) => { state.balance += data.availableBalance.increment; return {}; },
    },
    payout: {
      findFirst: async ({ where }) => state.payouts.find(p => Object.entries(where).every(([k,v]) => p[k] === v)) || null,
      findUnique: async ({ where }) => state.payouts.find(p => p.id === where.id) || null,
      create: async ({ data }) => { const p = { id: String(state.payouts.length + 1), ...data };state.payouts.push(p);return p; },
      updateMany: async ({ where, data }) => {
        const p = state.payouts.find(p => p.id === where.id && p.status === where.status);
        if (!p) return { count: 0 };Object.assign(p,data);return { count: 1 };
      },
    },
  };
  return { ...tx, state: () => state, $transaction: fn => {
    const run = queue.then(async () => { const before = structuredClone(state);try { return await fn(tx); } catch(e) { state=before;throw e; } });
    queue=run.catch(()=>{});return run;
  } };
}
const input = { amount: 80, method: 'paypal', methodDetails: { destination: 'synthetic' }, idempotencyKey: 'request-one' };
it('reserves once for a repeated request and rejects reuse with a different amount', async () => {
  const db=database();
  const [a,b]=await Promise.all([requestPayout(db,'u',input),requestPayout(db,'u',input)]);
  expect(a.id).toBe(b.id);expect(db.state().balance).toBe(20);expect(db.state().payouts).toHaveLength(1);
  await expect(requestPayout(db,'u',{...input,amount:90})).rejects.toMatchObject({statusCode:409});
});
it('refuses a second reservation when the remaining balance is insufficient', async () => {
  const db=database();
  const results=await Promise.allSettled([requestPayout(db,'u',input),requestPayout(db,'u',{...input,idempotencyKey:'request-two'})]);
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(db.state().balance).toBe(20);
});
it('refunds a failed payout once, including simultaneous retries', async () => {
  const db=database();const p=await requestPayout(db,'u',input);
  await Promise.all([processPayout(db,p.id,{action:'FAIL',failureReason:'synthetic'}),processPayout(db,p.id,{action:'FAIL',failureReason:'synthetic'})]);
  expect(db.state().balance).toBe(100);
  await expect(processPayout(db,p.id,{action:'COMPLETE',transactionId:'receipt'})).rejects.toMatchObject({statusCode:409});
});
it.each([0,-1,NaN,1.001,'80',null])('rejects invalid payout amounts at the boundary', async amount => {
  const db=database();await expect(requestPayout(db,'u',{...input,amount})).rejects.toThrow();expect(db.state().balance).toBe(100);
});
it('imports a provider receipt once and does not create a second historical payout on retry', async () => {
  const db=database();
  const row={email:'synthetic@example.test',amount:'80.00',method:'paypal',transactionId:'synthetic-receipt'};
  const first=await importCompletedPayout(db,row,'finance');
  const retry=await importCompletedPayout(db,row,'finance');
  expect(retry.id).toBe(first.id);expect(db.state().payouts).toHaveLength(1);
  await expect(importCompletedPayout(db,{...row,amount:'90.00'},'finance')).rejects.toMatchObject({statusCode:409});
});
