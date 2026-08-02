// ===========================================
// ROLE-BASED ACCESS CONTROL
// ===========================================
// Two layers:
//  1. requireRole(...roles)       - coarse gate on req.user.role
//  2. requirePermission(permission) - fine-grained gate that checks, in order:
//       a. req.user.permissions (nullable JSON array on the User model) -
//          lets a Super Admin grant a specific employee extra capabilities
//          without any code change.
//       b. the static ROLE_PERMISSIONS default-permissions-per-role map
//          below, as a sane fallback so every role works out of the box.
//
// Keep ROLE_PERMISSIONS small. It is not the only mechanism for granting
// permissions - it is just the default so new employee roles are useful
// immediately. Anything more specific belongs on User.permissions.

// The role matrix. Each admin-panel role gets exactly the surface it needs
// to do its job and nothing else - two boundaries are deliberate and load
// bearing:
//
//   1. Owner-only powers (platform settings, employee management, the audit
//      trail) stay on SUPER_ADMIN. An ADMIN runs the business day to day but
//      cannot change how the platform is configured, hire/promote staff, or
//      read - let alone be trusted to police - the record of what staff did.
//
//   2. Separation of duties on money. ADMIN approves releases and manages
//      users; FINANCE moves money. No single non-owner account can both
//      authorize an operation and disburse against it. This is why ADMIN has
//      finance:read/payouts:read (it needs the visibility to run operations)
//      but none of finance:write, payouts:process or wallets:adjust.
export const ROLE_PERMISSIONS = {
  // Everything, unconditionally - including settings, employees and audit.
  SUPER_ADMIN: ['*'],

  // Releases, users, labels, tickets and operations.
  // Labels are User rows with role LABEL, so users:* covers "sellos" -
  // there is no separate labels:* surface to grant.
  ADMIN: [
    'dashboard:read',
    'users:read',
    'users:write',
    'users:status',
    'releases:read',
    'releases:approve',
    'releases:reject',
    'releases:media',
    'takedowns:read',
    'takedowns:execute',
    'tickets:*',
    'announcements:manage',
    'testimonials:moderate',
    'contributors:approve',
    // Read-only money visibility: an ADMIN can see the finance picture to
    // run operations, but cannot alter a balance or release a payout.
    'finance:read',
    'payouts:read',
  ],

  // Catalog review: needs the actual assets (audio, cover art) and the
  // rights metadata behind a submission to make an approve/reject call.
  // users:read is scoped to seeing who submitted what, nothing more.
  REVIEWER: [
    'releases:read',
    'releases:approve',
    'releases:reject',
    'releases:media',
    'users:read',
  ],

  // Support desk: tickets, plus read-only account context so an agent can
  // actually see the plan/status of the account they are helping instead of
  // answering blind.
  SUPPORT: [
    'tickets:*',
    'users:read',
  ],

  // Money: wallets, royalties, payouts, holds and reversals.
  //
  // NOTE: royalties:* and reversals:* have no routes behind them yet - the
  // royalty hold/release and financial-reversal workflows are still to be
  // built. They are declared here so the matrix stays the single spec of
  // who owns what, and wiring the routes later needs no change to this file.
  //
  // The two-person rule on reversals is NOT expressible as a permission:
  // holding both reversals:request and reversals:approve is intentional, and
  // the "approver must be a different user than the requester" check has to
  // live in the reversal endpoint itself when it is built.
  FINANCE: [
    'dashboard:read',
    'finance:read',
    'finance:write',
    'payouts:read',
    'payouts:process',
    'wallets:read',
    'wallets:adjust',
    'royalties:read',
    'royalties:hold',
    'royalties:release',
    'reversals:request',
    'reversals:approve',
    'users:read',
  ],

  // Platform customers - they never touch the admin panel at all (the
  // router-level requireRole gate in routes/admin.js keeps them out).
  ARTIST: [],
  LABEL: [],
};

function roleHasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;

  // Support simple namespace wildcards like "tickets:*" matching "tickets:read".
  const namespace = permission.split(':')[0];
  if (perms.includes(`${namespace}:*`)) return true;

  return false;
}

export function userHasPermission(user, permission) {
  if (!user) return false;

  const overrides = Array.isArray(user.permissions) ? user.permissions : [];
  if (overrides.includes('*') || overrides.includes(permission)) return true;

  const namespace = permission.split(':')[0];
  if (overrides.includes(`${namespace}:*`)) return true;

  return roleHasPermission(user.role, permission);
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to access this resource' });
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    if (!userHasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Forbidden', message: `Missing required permission: ${permission}` });
    }
    next();
  };
}
