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

export const ExpenseDetailSchema = ExpenseSchema.extend({
  reference: z.string().nullable(),
});

export const ExpenseBranchLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type Expense = z.infer<typeof ExpenseSchema>;
export type ExpenseDetail = z.infer<typeof ExpenseDetailSchema>;
export type ExpenseBranchLabel = z.infer<typeof ExpenseBranchLabelSchema>;
