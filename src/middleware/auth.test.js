import { beforeEach, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
const db = vi.hoisted(() => ({ session: { findFirst: vi.fn(), update: vi.fn() }, user: { findUnique: vi.fn() } }));
vi.mock('../lib/prisma.js', () => ({ prisma: db }));
import { authenticate } from './auth.js';

beforeEach(() => {
  vi.resetAllMocks();
  process.env.JWT_SECRET = 'synthetic-unit-test-key';
  db.session.findFirst.mockImplementation(async ({ where }) => where.id === 'session-one' ? { id: 'session-one', lastActivityAt: new Date() } : null);
  db.user.findUnique.mockResolvedValue({ id: 'user-one', status: 'ACTIVE' });
});
async function request(claims) {
  const req = { headers: { authorization: `Bearer ${jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '1h' })}` } };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await authenticate(req, res, next);
  return { req, res, next };
}
it('accepts access tokens only for their own active session', async () => {
  const { req, next } = await request({ userId: 'user-one', sid: 'session-one', type: 'access' });
  expect(next).toHaveBeenCalledWith();
  expect(req.sessionId).toBe('session-one');
});
it.each([
  { userId: 'user-one', sid: 'session-one', type: 'refresh' },
  { userId: 'user-one' },
  { userId: 'user-one', sid: 'revoked-session', type: 'access' },
])('rejects incorrect token purpose or a revoked/missing session', async claims => {
  const { res, next } = await request(claims);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});
