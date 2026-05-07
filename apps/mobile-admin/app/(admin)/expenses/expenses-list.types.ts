export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  receipt_url: string | null;
  branch_id: string | null;
}
