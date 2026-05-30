import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { AIAnalysisResult } from '@/lib/validation';
import { SwapTradeInResultStep } from './SwapTradeInResultStep';

const result: AIAnalysisResult = {
  basePrice: 300000,
  deductionPercent: 10,
  estimatedValue: 270000,
  grade: 'Good',
  model: 'iPhone 13 Pro',
  observations: ['Minor screen scratch', 'Battery health at 89%'],
};

describe('SwapTradeInResultStep', () => {
  it('renders nothing without a result', () => {
    const { toJSON } = render(
      <SwapTradeInResultStep
        colors={Colors.light}
        onAcceptOffer={jest.fn()}
        onReset={jest.fn()}
        result={null}
      />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders valuation details and handles result actions', () => {
    const onAcceptOffer = jest.fn();
    const onReset = jest.fn();

    render(
      <SwapTradeInResultStep
        colors={Colors.light}
        onAcceptOffer={onAcceptOffer}
        onReset={onReset}
        result={result}
      />
    );

    expect(screen.getByText('Estimated Trade-in Value')).toBeTruthy();
    expect(screen.getByText('N270,000')).toBeTruthy();
    expect(screen.getByText('Based on market price: N300,000')).toBeTruthy();
    expect(screen.getByText('iPhone 13 Pro')).toBeTruthy();
    expect(screen.getByText('Good')).toBeTruthy();
    expect(screen.getByText('• Minor screen scratch')).toBeTruthy();

    fireEvent.press(screen.getByText('Accept Offer & Chat'));
    fireEvent.press(screen.getByText('Try Another Device'));

    expect(onAcceptOffer).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
