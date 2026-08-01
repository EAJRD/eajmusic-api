import { z } from 'zod';

// Roles a Super Admin can hand out via POST /admin/users (employee accounts).
// ARTIST/LABEL sign up themselves via /auth/register; SUPER_ADMIN is
// intentionally excluded here - promote via PATCH /users/:id/role instead.
const EMPLOYEE_ROLES = ['SUPPORT', 'REVIEWER', 'FINANCE', 'ADMIN'];
const ALL_ROLES = ['ARTIST', 'LABEL', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'REVIEWER', 'FINANCE'];

export const createEmployeeSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255).trim(),
  // No password field: InsForge (the credential front door) always requires
  // the account holder to choose their own via signUp() - see POST
  // /admin/users in admin.js.
  role: z.enum(EMPLOYEE_ROLES),
  permissions: z.array(z.string()).optional().default([]),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(ALL_ROLES),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED']),
});

export const updateSettingSchema = z.object({
  value: z.any(),
  description: z.string().max(1000).optional().nullable(),
});
