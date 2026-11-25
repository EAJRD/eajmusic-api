import { it, expect, vi } from 'vitest';
import { applyPaymentWebhook } from './paymentWebhook.js';
const input = { status: 'COMPLETED', metadata2: 'synthetic-reference', referenceNumber: 'receipt-one', total: '25.00' };
function db() {
  const row={id:'p',userId:'u',amount:25,currency:'USD',status:'PENDING',metadata:{referenceId:'synthetic-reference'}};
  const tx={ paymentTransaction:{findFirst:async()=>({...row}),updateMany:async({where,data})=>{if(row.status!==where.status)return {count:0};Object.assign(row,data);return {count:1}}},auditLog:{create:vi.fn()} };
  return {...tx,$transaction:async fn=>fn(tx),row};
}
it('fails closed when webhook authentication is unconfigured or incorrect',async()=>{
  const database=db();
  await expect(applyPaymentWebhook(database,input,undefined,'synthetic-secret')).rejects.toMatchObject({statusCode:503});
  await expect(applyPaymentWebhook(database,input,'synthetic-secret','incorrect')).rejects.toMatchObject({statusCode:403});
  expect(database.row.status).toBe('PENDING');
});
it('rejects invalid totals and unknown statuses without touching the transaction',async()=>{
  for(const change of [{total:'0.01'},{total:'25.00abc'},{total:'NaN'},{status:'UNKNOWN'},{currency:'EUR'}]) {
    const database=db();await expect(applyPaymentWebhook(database,{...input,...change},'synthetic-secret','synthetic-secret')).rejects.toThrow();
    expect(database.row.status).toBe('PENDING');
  }
});
it('applies once and refuses to overwrite a terminal outcome',async()=>{
  const database=db();
  await applyPaymentWebhook(database,input,'synthetic-secret','synthetic-secret');
  await applyPaymentWebhook(database,input,'synthetic-secret','synthetic-secret');
  expect(database.auditLog.create).toHaveBeenCalledTimes(1);
  expect(database.row.status).toBe('COMPLETED');
  await expect(applyPaymentWebhook(database,{...input,status:'FAILED'},'synthetic-secret','synthetic-secret')).rejects.toMatchObject({statusCode:409});
});
