import { z } from 'zod';

export const ExpenseSchema = z.object({
  id: z.string(),
  amount: z.number(),
  category: z.string(),
  description: z.string().nullable(),
  date: z.string(),
  receipt_url: z.string().nullable(),
  branch_id: z.string().nullable(),
});

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  receipt_url: string | null;
  branch_id: string | null;
}
