import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestBranchScope = { type: 'all' } | { type: 'branch'; branchId: string };

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  expenseFieldsProps: {
    amount: '',
    description: '',
    onAmountChange: ((_: string) => undefined) as (value: string) => void,
    onDescriptionChange: ((_: string) => undefined) as (value: string) => void,
    onOpenCategorySheet: (() => undefined) as () => void,
    onReceiptPress: (() => undefined) as () => void,
    receiptUri: null as string | null,
  },
  imagePicker: vi.fn(),
  insert: vi.fn(),
  invalidateQueries: vi.fn(),
  branches: [] as Array<{ id: string; is_default: boolean }>,
  branchesLoading: false,
  branchScope: { type: 'branch', branchId: 'branch-1' } as TestBranchScope,
  merchant: { id: 'merchant-1' },
  router: { back: vi.fn() },
  upload: vi.fn(),
}));

function createMutationMock() {
  return ({
    mutationFn,
    onError,
    onSuccess,
  }: {
    mutationFn: () => Promise<void>;
    onError?: (error: Error) => void;
    onSuccess?: () => void;
  }) => ({
    isPending: false,
    mutate: async () => {
      try {
        await mutationFn();
        onSuccess?.();
      } catch (error) {
        onError?.(error as Error);
      }
    },
  });
}

async function invokeAlertButton(title: string, buttonIndex = 0) {
  await waitFor(() => {
    expect(
      mocks.alert.mock.calls.find(([alertTitle]) => alertTitle === title)
    ).toBeTruthy();
  });

  const matchingCall = mocks.alert.mock.calls.find(
    ([alertTitle]) => alertTitle === title
  );
  matchingCall?.[2]?.[buttonIndex]?.onPress?.();
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: createMutationMock(),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      error: '#ef4444',
      primary: '#3b82f6',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
    },
  }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({ scope: mocks.branchScope }),
}));

vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({
    data: mocks.branches,
    isLoading: mocks.branchesLoading,
  }),
}));

vi.mock('@/components/ui/AppFormScreen', () => ({
  AppFormScreen: ({
    children,
    footer,
  }: {
    children?: ReactNode;
    footer?: ReactNode;
  }) => (
    <section aria-label="expense-form-screen">
      <div>{children}</div>
      <div>{footer}</div>
    </section>
  ),
}));

vi.mock('@/components/expenses/ExpenseFormFields', () => ({
  ExpenseFormFields: (props: {
    amount: string;
    description: string;
    onAmountChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onOpenCategorySheet: () => void;
    onReceiptPress: () => void;
    receiptUri: string | null;
  }) => {
    mocks.expenseFieldsProps.amount = props.amount;
    mocks.expenseFieldsProps.description = props.description;
    mocks.expenseFieldsProps.onAmountChange = props.onAmountChange;
    mocks.expenseFieldsProps.onDescriptionChange = props.onDescriptionChange;
    mocks.expenseFieldsProps.onOpenCategorySheet = props.onOpenCategorySheet;
    mocks.expenseFieldsProps.onReceiptPress = props.onReceiptPress;
    mocks.expenseFieldsProps.receiptUri = props.receiptUri;

    return (
      <>
        <input
          aria-label="Expense amount"
          onChange={(event) => props.onAmountChange(event.target.value)}
          value={props.amount}
        />
        <input
          aria-label="Expense description"
          onChange={(event) => props.onDescriptionChange(event.target.value)}
          value={props.description}
        />
        <button
          aria-label="Select expense category"
          onClick={props.onOpenCategorySheet}
          type="button"
        >
          Select category
        </button>
        <button
          aria-label="Add expense receipt"
          onClick={props.onReceiptPress}
          type="button"
        >
          Add receipt
        </button>
      </>
    );
  },
}));

vi.mock('@/components/expenses/ExpenseCategorySheet', () => ({
  ExpenseCategorySheet: ({ visible }: { visible: boolean }) =>
    visible ? <div>Category sheet</div> : null,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mocks.insert,
    }),
    storage: {
      from: () => ({
        getPublicUrl: () => ({
          data: { publicUrl: 'https://example.com/file' },
        }),
        upload: mocks.upload,
      }),
    },
  },
}));

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: mocks.imagePicker,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: Object.assign(
      ({ children }: { children?: React.ReactNode }) => children,
      {
        Screen: ({
          options,
        }: {
          options?: { headerLeft?: () => React.ReactNode; title?: string };
        }) =>
          React.createElement(
            'div',
            null,
            options?.title
              ? React.createElement('span', null, options.title)
              : null,
            options?.headerLeft ? options.headerLeft() : null
          ),
      }
    ),
    useRouter: () => mocks.router,
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: mocks.alert },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import AddExpenseScreen from './new';

describe('AddExpenseScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.expenseFieldsProps.amount = '';
    mocks.expenseFieldsProps.description = '';
    mocks.expenseFieldsProps.receiptUri = null;
    mocks.branches = [];
    mocks.branchesLoading = false;
    mocks.branchScope = { type: 'branch', branchId: 'branch-1' };
    mocks.insert.mockResolvedValue({ error: null });
    mocks.imagePicker.mockResolvedValue({ assets: [], canceled: true });
    mocks.upload.mockResolvedValue({ error: null });
  });

  it('renders the add expense screen shell and opens the category sheet', () => {
    render(<AddExpenseScreen />);

    expect(screen.getByText('Add Expense')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'expense-form-screen' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Expense amount')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save expense' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select expense category'));

    expect(screen.getByText('Category sheet')).toBeInTheDocument();
  });

  it('rejects invalid amount input and keeps save disabled for invalid numeric values', () => {
    render(<AddExpenseScreen />);

    const amountInput = screen.getByLabelText('Expense amount');
    const saveButton = screen.getByRole('button', { name: 'Save expense' });

    fireEvent.change(amountInput, { target: { value: '12a3' } });

    expect((amountInput as HTMLInputElement).value).toBe('');

    fireEvent.change(amountInput, { target: { value: '.' } });

    expect(saveButton).toBeDisabled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('selects a receipt and saves a complete expense payload through the shared form shell', async () => {
    mocks.imagePicker.mockResolvedValueOnce({
      assets: [{ uri: 'file:///receipt.jpg' }],
      canceled: false,
    });

    render(<AddExpenseScreen />);

    fireEvent.change(screen.getByLabelText('Expense amount'), {
      target: { value: '12500' },
    });
    fireEvent.change(screen.getByLabelText('Expense description'), {
      target: { value: 'Office internet' },
    });
    fireEvent.click(screen.getByLabelText('Add expense receipt'));
    await waitFor(() => {
      expect(mocks.imagePicker).toHaveBeenCalled();
      expect(mocks.expenseFieldsProps.receiptUri).toBe('file:///receipt.jpg');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }));

    await waitFor(() => {
      expect(mocks.upload).toHaveBeenCalled();
      expect(mocks.insert).toHaveBeenCalledWith({
        amount: 12500,
        branch_id: 'branch-1',
        category: 'Inventory',
        description: 'Office internet',
        date: expect.any(String),
        merchant_id: 'merchant-1',
        receipt_url: 'https://example.com/file',
      });
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['expenses'],
      });
    });

    await invokeAlertButton('Success');
    expect(mocks.router.back).toHaveBeenCalledTimes(1);
  });

  it('shows a generic error alert when saving fails', async () => {
    mocks.insert.mockResolvedValue({
      error: new Error('Insert failed'),
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(<AddExpenseScreen />);

    fireEvent.change(screen.getByLabelText('Expense amount'), {
      target: { value: '12500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong. Please try again.'
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
    expect(mocks.router.back).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('prevents saving when no branch can be selected', () => {
    mocks.branchScope = { type: 'all' };

    render(<AddExpenseScreen />);

    fireEvent.change(screen.getByLabelText('Expense amount'), {
      target: { value: '12500' },
    });
    const saveButton = screen.getByRole('button', { name: 'Save expense' });

    expect(saveButton).toBeDisabled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
