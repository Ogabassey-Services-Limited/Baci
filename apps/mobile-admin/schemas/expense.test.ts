import { describe, expect, it } from 'vitest';
import { ExpenseDetailSchema, ExpenseSchema } from './expense';

describe('ExpenseSchema', () => {
  it('parses expense list rows returned by Supabase', () => {
    expect(
      ExpenseSchema.parse({
        amount: 12500,
        branch_id: 'branch-1',
        category: 'Inventory',
        date: '2026-05-05T00:00:00.000Z',
        description: null,
        id: 'expense-1',
        receipt_url: null,
      })
    ).toEqual({
      amount: 12500,
      branch_id: 'branch-1',
      category: 'Inventory',
      date: '2026-05-05T00:00:00.000Z',
      description: null,
      id: 'expense-1',
      receipt_url: null,
    });
  });

  it('rejects drifted expense amounts before the UI renders them', () => {
    expect(() =>
      ExpenseSchema.parse({
        amount: '12500',
        branch_id: null,
        category: 'Inventory',
        date: '2026-05-05T00:00:00.000Z',
        description: null,
        id: 'expense-1',
        receipt_url: null,
      })
    ).toThrow();
  });

  it('parses expense detail rows returned by Supabase', () => {
    expect(
      ExpenseDetailSchema.parse({
        amount: 12500,
        branch_id: 'branch-1',
        category: 'Inventory',
        date: '2026-05-05T00:00:00.000Z',
        description: 'Office internet',
        id: 'expense-1',
        receipt_url: null,
        reference: null,
      })
    ).toEqual({
      amount: 12500,
      branch_id: 'branch-1',
      category: 'Inventory',
      date: '2026-05-05T00:00:00.000Z',
      description: 'Office internet',
      id: 'expense-1',
      receipt_url: null,
      reference: null,
    });
  });
});
