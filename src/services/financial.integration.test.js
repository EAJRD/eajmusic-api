import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { requestPayout, processPayout } from './payoutService.js';
import { applyPaymentWebhook } from './paymentWebhook.js';

// Explicit opt-in, restricted to the disposable CI database. Never use the
// application's DATABASE_URL or load dotenv in integration tests.
const url = process.env.EAJ_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/eajmusic_test') {
    throw new Error('Integration tests require a loopback eajmusic_test database');
  }
}
describe.skipIf(!url)('financial transactions on isolated PostgreSQL', () => {
  let db;
  const users=[];
  beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}})});
  afterEach(async()=>{
    const where={userId:{in:[...users]}};
    await db.auditLog.deleteMany({where});
    await db.paymentTransaction.deleteMany({where});
    await db.payout.deleteMany({where});
    await db.wallet.deleteMany({where});
    await db.user.deleteMany({where:{id:{in:users.splice(0)}}});
  });
  afterAll(async()=>{await db?.$disconnect()});
  async function account() {
    const user=await db.user.create({data:{email:`audit-${crypto.randomUUID()}@example.test`,name:'Synthetic',passwordHash:'unusable-test-placeholder',status:'ACTIVE',wallet:{create:{availableBalance:100}}}});
    users.push(user.id);return user;
  }
  const input=key=>({amount:80,method:'paypal',methodDetails:{destination:'synthetic'},idempotencyKey:key});
  it('concurrent reservations cannot overdraw a wallet',async()=>{
    const user=await account();
    const results=await Promise.allSettled([requestPayout(db,user.id,input('one')),requestPayout(db,user.id,input('two'))]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(Number((await db.wallet.findUnique({where:{userId:user.id}})).availableBalance)).toBe(20);
    expect(await db.payout.count({where:{userId:user.id}})).toBe(1);
  });
  it('concurrent retries create one reservation and one refund',async()=>{
    const user=await account();
    const [a,b]=await Promise.all([requestPayout(db,user.id,input('same')),requestPayout(db,user.id,input('same'))]);
    expect(a.id).toBe(b.id);
    await Promise.all([processPayout(db,a.id,{action:'FAIL',failureReason:'synthetic'}),processPayout(db,a.id,{action:'FAIL',failureReason:'synthetic'})]);
    expect(Number((await db.wallet.findUnique({where:{userId:user.id}})).availableBalance)).toBe(100);
  });
  it('duplicate authenticated callbacks commit one terminal outcome and one audit record',async()=>{
    const user=await account();const reference=crypto.randomUUID();
    const transaction=await db.paymentTransaction.create({data:{userId:user.id,provider:'ATH_MOVIL',amount:25,currency:'USD',metadata:{referenceId:reference}}});
    const body={status:'COMPLETED',metadata2:reference,referenceNumber:crypto.randomUUID(),total:'25.00'};
    await Promise.all([applyPaymentWebhook(db,body,'synthetic-secret','synthetic-secret'),applyPaymentWebhook(db,body,'synthetic-secret','synthetic-secret')]);
    expect((await db.paymentTransaction.findUnique({where:{id:transaction.id}})).status).toBe('COMPLETED');
    expect(await db.auditLog.count({where:{entityId:transaction.id}})).toBe(1);
  });
});
