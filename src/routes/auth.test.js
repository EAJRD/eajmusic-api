import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
const db=vi.hoisted(()=>({session:{findFirst:vi.fn(),updateMany:vi.fn()}}));
vi.mock('../lib/prisma.js',()=>({prisma:db}));
import router from './auth.js';
let server,base,activeToken;
beforeEach(async()=>{
  vi.resetAllMocks();process.env.JWT_SECRET='synthetic-session-test-key';
  activeToken=jwt.sign({userId:'owner',sid:'session-one',type:'refresh',jti:'original'},process.env.JWT_SECRET,{expiresIn:'1h'});
  db.session.findFirst.mockImplementation(async({where})=>where.id==='session-one'&&where.refreshToken===activeToken?{id:'session-one'}:null);
  db.session.updateMany.mockImplementation(async({where,data})=>{if(where.refreshToken!==activeToken)return {count:0};activeToken=data.refreshToken;return {count:1}});
  const app=express();app.use(express.json());app.use(router);
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;
});
afterEach(async()=>{await new Promise(resolve=>server.close(resolve))});
const refresh=token=>fetch(base+'/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:token})});
it('rotates once and binds returned access and refresh tokens to the same session',async()=>{
  const old=activeToken;
  const response=await refresh(old);expect(response.status).toBe(200);
  const body=await response.json();
  expect(jwt.verify(body.accessToken,process.env.JWT_SECRET)).toMatchObject({type:'access',sid:'session-one',userId:'owner'});
  expect(jwt.verify(body.refreshToken,process.env.JWT_SECRET)).toMatchObject({type:'refresh',sid:'session-one'});
  expect(body.refreshToken).not.toBe(old);
  expect((await refresh(old)).status).toBe(401);
});
it('does not issue two successful rotations for simultaneous use of one refresh token',async()=>{
  const old=activeToken;const results=await Promise.all([refresh(old),refresh(old)]);
  expect(results.map(response=>response.status).sort()).toEqual([200,401]);
});
