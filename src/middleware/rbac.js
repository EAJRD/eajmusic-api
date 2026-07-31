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

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'users:read',
    'users:write',
    'users:status',
    'releases:read',
    'releases:approve',
    'releases:reject',
    'payouts:read',
    'payouts:process',
    'settings:read',
    'settings:write',
    'testimonials:moderate',
    'tickets:*',
    'announcements:manage',
    'finance:read',
    'finance:write',
    'audit:read',
  ],
  SUPPORT: ['tickets:*'],
  REVIEWER: ['releases:read', 'releases:approve', 'releases:reject'],
  FINANCE: ['payouts:process', 'payouts:read', 'finance:read', 'finance:write'],
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
