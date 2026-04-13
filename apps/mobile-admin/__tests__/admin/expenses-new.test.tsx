import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  expenseFieldsProps: {
    amount: '',
    onAmountChange: ((_: string) => undefined) as (value: string) => void,
  },
  imagePicker: vi.fn(),
  insert: vi.fn(),
  invalidateQueries: vi.fn(),
  merchant: { id: 'merchant-1' },
  router: { back: vi.fn() },
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
    onAmountChange: (value: string) => void;
  }) => {
    mocks.expenseFieldsProps.amount = props.amount;
    mocks.expenseFieldsProps.onAmountChange = props.onAmountChange;

    return (
      <input
        aria-label="Expense amount"
        onChange={(event) => props.onAmountChange(event.target.value)}
        value={props.amount}
      />
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
        upload: vi.fn(),
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
          options?: { headerLeft?: () => React.ReactNode };
        }) =>
          options?.headerLeft
            ? React.createElement('div', null, options.headerLeft())
            : null,
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

import AddExpenseScreen from '@/app/(admin)/expenses/new';

describe('AddExpenseScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.imagePicker.mockResolvedValue({ assets: [], canceled: true });
  });

  it('saves an expense through the shared form shell', async () => {
    render(<AddExpenseScreen />);

    expect(
      screen.getByRole('region', { name: 'expense-form-screen' })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Expense amount'), {
      target: { value: '12500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }));

    await waitFor(() => {
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12500,
          category: 'Inventory',
          merchant_id: 'merchant-1',
          receipt_url: null,
        })
      );
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['expenses'],
    });
    await invokeAlertButton('Success');
    expect(mocks.router.back).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert when saving fails', async () => {
    mocks.insert.mockResolvedValue({
      error: new Error('Insert failed'),
    });

    render(<AddExpenseScreen />);

    fireEvent.change(screen.getByLabelText('Expense amount'), {
      target: { value: '12500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Insert failed');
    });
    expect(mocks.router.back).not.toHaveBeenCalled();
  });
});
