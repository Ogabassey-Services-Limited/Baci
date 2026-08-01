import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize-core';
import {
  isValidTaxIdentificationNumber,
  normalizeTaxIdentificationNumber,
} from '@/lib/tax-identification';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

const sanitize = (s: string) => sanitizeText(s);

const optionalBusinessNameSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(2).max(200).transform(sanitize).optional()
);

export const cacSearchSchema = z.object({
  searchTerm: z.string().min(2).max(200).transform(sanitize),
});

export const cacVerifyFormSchema = z.object({
  rcNumber: z.string().trim().min(1).max(50).transform(sanitize),
  approvedName: z.string().trim().min(1).max(200).transform(sanitize),
  merchantId: merchantIdParamSchema,
});

export const taxIdVerifySchema = z.object({
  merchantId: merchantIdParamSchema,
  taxIdentificationNumber: z
    .string()
    .transform((value) => normalizeTaxIdentificationNumber(value))
    .refine((value) => isValidTaxIdentificationNumber(value), {
      error: 'TIN must be 10 to 15 digits',
    }),
  legalEntityName: optionalBusinessNameSchema,
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
    {
      error: 'Invalid calendar date',
    }
  );

export const bvnVerifySchema = z.object({
  merchantId: merchantIdParamSchema,
  bvn: z.string().regex(/^\d{11}$/),
  firstName: z.string().trim().min(1).max(100).transform(sanitize),
  lastName: z.string().trim().min(1).max(100).transform(sanitize),
  dateOfBirth: dateOfBirthSchema,
  mobileNo: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z
      .string()
      .trim()
      .regex(/^0\d{10}$/, 'Invalid Nigerian mobile number format')
      .transform(sanitize)
      .optional()
  ),
});

export const ninVerifySchema = z.object({
  merchantId: merchantIdParamSchema,
  nin: z.string().regex(/^\d{11}$/),
  firstName: z.string().trim().min(1).max(100).transform(sanitize),
  lastName: z.string().trim().min(1).max(100).transform(sanitize),
  dateOfBirth: dateOfBirthSchema,
});
