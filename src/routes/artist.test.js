import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
const db=vi.hoisted(()=>({
  user:{update:vi.fn()},artistProfile:{findFirst:vi.fn()},supportTicket:{create:vi.fn()},
  storedUpload:{findUnique:vi.fn()},release:{create:vi.fn(),findFirst:vi.fn(),update:vi.fn(),findUnique:vi.fn()},
  track:{findMany:vi.fn(),update:vi.fn()},auditLog:{create:vi.fn()},$transaction:vi.fn(),
}));
vi.mock('../lib/prisma.js',()=>({prisma:db}));
vi.mock('../middleware/auth.js',()=>({authenticate:(req,res,next)=>{req.user={id:'owner',role:'ARTIST',emailVerified:true,onboardingCompletedAt:new Date(),subscription:{plan:'FREE'}};next()}}));
vi.mock('../services/contributorMatchService.js',()=>({detectContributorMatches:vi.fn()}));
vi.mock('../services/n8nWebhookService.js',()=>({notifyN8n:vi.fn()}));
import router from './artist.js';
let server, base;
beforeEach(async()=>{
  vi.resetAllMocks();db.$transaction.mockImplementation(fn=>fn(db));
  const app=express();app.use(express.json());app.use(router);app.use((err,req,res,next)=>res.status(err.statusCode||500).json({message:err.message}));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;
});
afterEach(async()=>{await new Promise(resolve=>server.close(resolve))});
const post=(path,body,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
it('finishes onboarding and opens an upgrade request without release metadata',async()=>{
  db.storedUpload.findUnique.mockResolvedValue({userId:'owner'});
  const response=await post('/onboarding',{artistName:'Synthetic artist',dateOfBirth:'2000-01-01',idDocumentUrl:'https://example.test/document',idDocumentKey:'documents/synthetic.pdf',plan:'PRO'});
  expect(response.status).toBe(200);expect(db.supportTicket.create).toHaveBeenCalledOnce();
});
it('rejects a release referencing an upload owned by another account',async()=>{
  db.storedUpload.findUnique.mockResolvedValue({userId:'other'});
  const response=await post('/releases',{title:'Synthetic',releaseType:'SINGLE',genre:'Pop',releaseDate:'2099-01-01',coverArtKey:'images/cover.png',tracks:[{title:'Synthetic',trackNumber:1}]});
  expect(response.status).toBe(403);expect(db.release.create).not.toHaveBeenCalled();
});
it('persists a track edit through the mounted PATCH route',async()=>{
  const track={id:'track-one',trackNumber:1,discNumber:1,title:'Before'};
  db.release.findFirst.mockResolvedValue({id:'release-one',status:'DRAFT'});
  db.track.findMany.mockResolvedValue([track]);db.track.update.mockImplementation(async({data})=>Object.assign(track,data));
  db.release.findUnique.mockImplementation(async()=>({id:'release-one',tracks:[track]}));
  const response=await post('/releases/release-one',{tracks:[{title:'After',trackNumber:1}]},'PATCH');
  expect(response.status).toBe(200);expect((await response.json()).tracks[0].title).toBe('After');
});
it('refuses a metadata-only PATCH that attempts to submit a release',async()=>{
  const response=await post('/releases/release-one',{status:'PENDING'},'PATCH');
  expect(response.status).toBe(400);expect(db.release.update).not.toHaveBeenCalled();
});
