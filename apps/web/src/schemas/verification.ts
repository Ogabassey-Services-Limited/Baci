import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize-core';

const sanitize = (s: string) => sanitizeText(s);

export const cacSearchSchema = z.object({
  searchTerm: z.string().min(2).max(200).transform(sanitize),
});

export const cacVerifyFormSchema = z.object({
  rcNumber: z.string().trim().min(1).max(50).transform(sanitize),
  approvedName: z.string().trim().min(1).max(200).transform(sanitize),
});

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(
    (s) => {
      const [y, m, d] = s.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return (
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
      );
    },
    { message: 'Invalid calendar date' }
  );

export const bvnVerifySchema = z.object({
  bvn: z.string().regex(/^\d{11}$/),
  firstName: z.string().trim().min(1).max(100).transform(sanitize),
  lastName: z.string().trim().min(1).max(100).transform(sanitize),
  dateOfBirth: dateOfBirthSchema,
  mobileNo: z
    .string()
    .regex(/^0\d{10}$/, 'Invalid Nigerian mobile number format'),
});

export const ninVerifySchema = z.object({
  nin: z.string().regex(/^\d{11}$/),
  firstName: z.string().trim().min(1).max(100).transform(sanitize),
  lastName: z.string().trim().min(1).max(100).transform(sanitize),
  dateOfBirth: dateOfBirthSchema,
});
