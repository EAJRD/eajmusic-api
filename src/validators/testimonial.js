import { z } from 'zod';

export const submitTestimonialSchema = z.object({
  quote: z
    .string()
    .min(10, 'Quote must be at least 10 characters')
    .max(2000, 'Quote too long')
    .trim(),
  photoUrl: z
    .string()
    .url('Invalid photo URL')
    .max(1000)
    .optional()
    .nullable(),
});

export const moderateTestimonialSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});
