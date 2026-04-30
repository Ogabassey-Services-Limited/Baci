import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { QuickRepeatPrompt } from './QuickRepeatPrompt';

function createTransaction(
  overrides: Partial<VTUHistoryTransaction> = {}
): VTUHistoryTransaction {
  return {
    amount: 2500,
    biller_name: 'EKEDC NG',
    created_at: '2026-04-08T12:00:00.000Z',
    customer_identifier: '43901766923',
    id: 'tx-1',
    request_reference: 'ref-1',
    status: 'successful',
    type: 'electricity',
    ...overrides,
  };
}

function renderPrompt(
  overrides: Partial<{
    isLoading: boolean;
    lastTransaction: VTUHistoryTransaction | null;
    notice: string | null;
    onQuickRepeat: () => void;
    showQuickRepeat: boolean;
    title: string;
  }> = {}
) {
  const props = {
    bottom: 16,
    colors: Colors.light,
    isLoading: false,
    lastTransaction: createTransaction(),
    notice: null,
    onQuickRepeat: jest.fn(),
    showQuickRepeat: true,
    title: 'Electricity',
    ...overrides,
  };

  const result = render(<QuickRepeatPrompt {...props} />);

  return { props, ...result };
}

describe('QuickRepeatPrompt', () => {
  it('renders a notice as an alert instead of the repeat action', () => {
    renderPrompt({
      isLoading: true,
      notice: 'Checking recent Electricity transactions...',
    });

    expect(
      screen.getByText('Checking recent Electricity transactions...')
    ).toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Repeat last Electricity transaction')
    ).toBeNull();
  });

  it('renders the last transaction amount and calls quick repeat', () => {
    const { props } = renderPrompt();

    expect(screen.getByText('Repeat last Electricity')).toBeOnTheScreen();
    expect(screen.getByText('₦2,500.00')).toBeOnTheScreen();

    fireEvent.press(
      screen.getByLabelText('Repeat last Electricity transaction')
    );

    expect(props.onQuickRepeat).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when quick repeat is hidden or missing a transaction', () => {
    const hidden = renderPrompt({ showQuickRepeat: false });

    expect(hidden.toJSON()).toBeNull();

    hidden.rerender(
      <QuickRepeatPrompt
        bottom={16}
        colors={Colors.light}
        isLoading={false}
        lastTransaction={null}
        notice={null}
        onQuickRepeat={jest.fn()}
        showQuickRepeat={true}
        title="Electricity"
      />
    );

    expect(hidden.toJSON()).toBeNull();
  });
});
