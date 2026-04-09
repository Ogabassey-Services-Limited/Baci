import { z } from 'zod';

export const cacSearchSchema = z.object({
  searchTerm: z.string().min(2).max(200),
});

export const cacVerifyFormSchema = z.object({
  rcNumber: z.string().min(1),
  approvedName: z.string().min(1),
});

export const bvnVerifySchema = z.object({
  bvn: z.string().regex(/^\d{11}$/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  mobileNo: z.string().min(1),
});

export const ninVerifySchema = z.object({
  nin: z.string().regex(/^\d{11}$/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
});
