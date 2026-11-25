import { it, expect } from 'vitest';
import express from 'express';
import { sanitizeQuery } from './query.js';
it('removes absent optional filters from the query seen by downstream Express 5 handlers', async () => {
  const app=express();app.use(sanitizeQuery);app.get('/',(req,res)=>res.json(req.query));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/?role=undefined&status=null&page=2`);
    expect(await response.json()).toEqual({page:'2'});
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
