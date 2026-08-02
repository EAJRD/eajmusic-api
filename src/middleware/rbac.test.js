import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, userHasPermission } from './rbac.js';

const user = (role, permissions = null) => ({ role, permissions });

// The two rules the matrix exists to enforce. These are written as explicit
// "must NOT have" assertions rather than snapshotting the whole permission
// list, so adding a new permission to a role stays a one-line change but
// re-opening one of these boundaries fails loudly.
describe('role matrix - owner-only powers', () => {
  const OWNER_ONLY = ['settings:read', 'settings:write', 'audit:read', 'employees:manage'];

  it.each(OWNER_ONLY)('SUPER_ADMIN has %s', (permission) => {
    expect(userHasPermission(user('SUPER_ADMIN'), permission)).toBe(true);
  });

  it.each(OWNER_ONLY)('ADMIN does NOT have %s', (permission) => {
    expect(userHasPermission(user('ADMIN'), permission)).toBe(false);
  });

  it.each(OWNER_ONLY)('FINANCE does NOT have %s', (permission) => {
    expect(userHasPermission(user('FINANCE'), permission)).toBe(false);
  });
});

describe('role matrix - separation of duties on money', () => {
  const MONEY_MOVING = ['finance:write', 'payouts:process', 'wallets:adjust'];

  it.each(MONEY_MOVING)('ADMIN cannot %s', (permission) => {
    expect(userHasPermission(user('ADMIN'), permission)).toBe(false);
  });

  it.each(MONEY_MOVING)('FINANCE can %s', (permission) => {
    expect(userHasPermission(user('FINANCE'), permission)).toBe(true);
  });

  it('ADMIN keeps read-only visibility into finance', () => {
    expect(userHasPermission(user('ADMIN'), 'finance:read')).toBe(true);
    expect(userHasPermission(user('ADMIN'), 'payouts:read')).toBe(true);
  });

  it.each(['SUPPORT', 'REVIEWER'])('%s has no finance access at all', (role) => {
    expect(userHasPermission(user(role), 'finance:read')).toBe(false);
    expect(userHasPermission(user(role), 'payouts:read')).toBe(false);
  });
});

describe('role matrix - per-role scope', () => {
  it('REVIEWER can review releases and their media, but not manage users', () => {
    expect(userHasPermission(user('REVIEWER'), 'releases:approve')).toBe(true);
    expect(userHasPermission(user('REVIEWER'), 'releases:media')).toBe(true);
    expect(userHasPermission(user('REVIEWER'), 'users:read')).toBe(true);
    expect(userHasPermission(user('REVIEWER'), 'users:write')).toBe(false);
    expect(userHasPermission(user('REVIEWER'), 'users:status')).toBe(false);
  });

  it('SUPPORT can work tickets and read account context, nothing more', () => {
    expect(userHasPermission(user('SUPPORT'), 'tickets:reply')).toBe(true);
    expect(userHasPermission(user('SUPPORT'), 'tickets:assign')).toBe(true);
    expect(userHasPermission(user('SUPPORT'), 'users:read')).toBe(true);
    expect(userHasPermission(user('SUPPORT'), 'users:status')).toBe(false);
    expect(userHasPermission(user('SUPPORT'), 'releases:approve')).toBe(false);
  });

  it('ADMIN owns catalog, people and takedowns', () => {
    expect(userHasPermission(user('ADMIN'), 'releases:approve')).toBe(true);
    expect(userHasPermission(user('ADMIN'), 'takedowns:execute')).toBe(true);
    expect(userHasPermission(user('ADMIN'), 'users:status')).toBe(true);
    expect(userHasPermission(user('ADMIN'), 'tickets:reply')).toBe(true);
  });

  it('SUPPORT and REVIEWER cannot read the revenue dashboard', () => {
    expect(userHasPermission(user('SUPPORT'), 'dashboard:read')).toBe(false);
    expect(userHasPermission(user('REVIEWER'), 'dashboard:read')).toBe(false);
    expect(userHasPermission(user('ADMIN'), 'dashboard:read')).toBe(true);
    expect(userHasPermission(user('FINANCE'), 'dashboard:read')).toBe(true);
  });

  it('platform customers hold no admin permissions', () => {
    for (const role of ['ARTIST', 'LABEL']) {
      expect(ROLE_PERMISSIONS[role]).toEqual([]);
      expect(userHasPermission(user(role), 'releases:read')).toBe(false);
    }
  });
});

describe('per-user overrides', () => {
  it('grants a permission the role lacks', () => {
    expect(userHasPermission(user('SUPPORT', ['releases:read']), 'releases:read')).toBe(true);
  });

  it('supports namespace wildcards', () => {
    expect(userHasPermission(user('SUPPORT', ['releases:*']), 'releases:approve')).toBe(true);
  });

  it('cannot be spoofed by a non-array permissions value', () => {
    expect(userHasPermission(user('SUPPORT', '*'), 'settings:write')).toBe(false);
  });
});
