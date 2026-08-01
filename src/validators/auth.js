import { z } from 'zod';

// Signup/login/OAuth/email-verification/password-reset all moved to
// InsForge (see AGENTS.md and POST /auth/sync-insforge-user) - this file
// only keeps schemas for routes this API still owns directly.

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name too long')
    .trim()
    .optional(),
  phone: z
    .string()
    .max(50)
    .optional()
    .nullable(),
  countryCode: z
    .string()
    .length(2, 'Country code must be 2 characters')
    .optional()
    .nullable(),
  timezone: z
    .string()
    .max(50)
    .optional(),
});

// Middleware to validate request body
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
