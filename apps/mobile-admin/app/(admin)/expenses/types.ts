import type { StyleProp, ViewStyle } from 'react-native';

export interface ExpenseDetail {
  id: string;
  amount: number;
  category: string;
  date: string;
  reference: string | null;
  description: string | null;
  receipt_url: string | null;
  branch_id: string | null;
}

export interface ExpenseDetailColors {
  background: string;
  border: string;
  card: string;
  primary: string;
  text: string;
  textSecondary: string;
}

export interface ExpenseStatusShellProps {
  status: 'loading' | 'error' | 'not-found';
  colors: ExpenseDetailColors;
  errorMessage?: string;
}

export interface ExpenseDetailsProps {
  expense: ExpenseDetail;
  branchName: string;
  colors: ExpenseDetailColors;
  formattedAmount: string;
  cardShadow?: StyleProp<ViewStyle>;
}
