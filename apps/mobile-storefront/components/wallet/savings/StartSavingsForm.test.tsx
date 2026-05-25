import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { StartSavingsForm } from './StartSavingsForm';
import type { StartSavingsController } from './use-start-savings-controller';

function createController(
  overrides: Partial<StartSavingsController> = {}
): StartSavingsController {
  return {
    acceptsNonWithdrawableTerms: false,
    contributionAmount: '',
    debouncedSearch: '',
    formError: null,
    frequency: 'daily',
    handleContinue: jest.fn(),
    handleSourceModeChange: jest.fn(),
    initialContributionAmount: '',
    initialContributionEnabled: false,
    isProductsLoading: false,
    isSubmitting: false,
    preferredDebitTime: '06:20',
    products: [],
    searchValue: '',
    selectProduct: jest.fn(),
    selectedProduct: null,
    setAcceptsNonWithdrawableTerms: jest.fn(),
    setContributionAmount: jest.fn(),
    setFrequency: jest.fn(),
    setInitialContributionAmount: jest.fn(),
    setInitialContributionEnabled: jest.fn(),
    setPreferredDebitTime: jest.fn(),
    setSearchValue: jest.fn(),
    setStartDate: jest.fn(),
    setTargetAmount: jest.fn(),
    sourceMode: 'manual',
    startDate: '2026-05-22',
    targetAmount: '',
    ...overrides,
  } as unknown as StartSavingsController;
}

describe('StartSavingsForm', () => {
  it('renders form fields and continues setup', () => {
    const setAcceptsNonWithdrawableTerms = jest.fn();
    const controller = createController({ setAcceptsNonWithdrawableTerms });
    render(<StartSavingsForm colors={Colors.light} controller={controller} />);

    expect(screen.getByText('Start Savings')).toBeOnTheScreen();
    expect(
      screen.getByText('Set up a device savings plan for your next purchase.')
    ).toBeOnTheScreen();
    expect(screen.getByText('Set primary source of funds')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'I understand savings are reserved for my selected purchase and cannot be withdrawn to a bank account.'
      )
    ).toBeOnTheScreen();

    fireEvent.changeText(
      screen.getByLabelText('Savings contribution amount'),
      '20000'
    );
    fireEvent.press(
      screen.getByRole('radio', { name: 'Initial contribution Yes' })
    );
    fireEvent.press(
      screen.getByRole('radio', { name: 'Use auto debit for savings' })
    );
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Accept non-withdrawable savings terms',
      })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Continue savings setup' })
    );

    expect(controller.setContributionAmount).toHaveBeenCalledWith('20000');
    expect(controller.setInitialContributionEnabled).toHaveBeenCalledWith(true);
    expect(controller.handleSourceModeChange).toHaveBeenCalledWith(
      'auto_debit'
    );
    expect(setAcceptsNonWithdrawableTerms).toHaveBeenCalledWith(
      expect.any(Function)
    );
    expect(controller.handleContinue).toHaveBeenCalledTimes(1);
  });

  it('shows form errors and disables continue while submitting', () => {
    render(
      <StartSavingsForm
        colors={Colors.light}
        controller={createController({
          formError: 'Enter a valid contribution amount.',
          isSubmitting: true,
        })}
      />
    );

    expect(
      screen.getByText('Enter a valid contribution amount.')
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Continue savings setup' })
    ).toBeDisabled();
  });
});
