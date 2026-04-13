export const EXPENSE_CATEGORIES = [
  'Inventory',
  'Marketing',
  'Salaries',
  'Rent',
  'Utilities',
  'Software',
  'Travel',
  'Meals',
  'Maintenance',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
