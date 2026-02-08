import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CryptoSelectorModal } from './CryptoSelectorModal';

describe('CryptoSelectorModal', () => {
  const defaultProps = {
    selectedCryptoCurrency: 'USDT' as const,
    selectedCryptoChain: 'TRX' as const,
    isInitializingCrypto: false,
    onCurrencyChange: vi.fn(),
    onChainChange: vi.fn(),
    onInitialize: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the modal title', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      expect(screen.getByText('Select Crypto Payment')).toBeInTheDocument();
    });

    it('renders USDT and USDC currency options', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      expect(screen.getByText('USDT')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
      expect(screen.getByText('Tether USD')).toBeInTheDocument();
      expect(screen.getByText('USD Coin')).toBeInTheDocument();
    });

    it('renders chain options for USDT (TRX, ETH)', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      expect(screen.getByText('TRX')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });

    it('renders chain options for USDC (ETH, MATIC, AVAXC)', () => {
      render(
        <CryptoSelectorModal
          {...defaultProps}
          selectedCryptoCurrency="USDC"
          selectedCryptoChain="ETH"
        />,
      );
      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.getByText('MATIC')).toBeInTheDocument();
      expect(screen.getByText('AVAXC')).toBeInTheDocument();
    });

    it('renders confirmation time for TRX', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      expect(screen.getByText('1-3 minutes')).toBeInTheDocument();
      expect(
        screen.getByText('Expected confirmation time'),
      ).toBeInTheDocument();
    });

    it('renders confirmation time for ETH', () => {
      render(
        <CryptoSelectorModal {...defaultProps} selectedCryptoChain="ETH" />,
      );
      expect(screen.getByText('5-30 minutes')).toBeInTheDocument();
    });

    it('renders confirmation time for MATIC', () => {
      render(
        <CryptoSelectorModal
          {...defaultProps}
          selectedCryptoCurrency="USDC"
          selectedCryptoChain="MATIC"
        />,
      );
      expect(screen.getByText('1-5 minutes')).toBeInTheDocument();
    });

    it('renders continue button with selected currency and chain', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      expect(
        screen.getByRole('button', {
          name: /continue with usdt on trx/i,
        }),
      ).toBeInTheDocument();
    });

    it('shows helper text about receiving wallet address', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      expect(
        screen.getByText(/receive a wallet address/i),
      ).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onCurrencyChange when USDC is selected', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      fireEvent.click(screen.getByText('USDC'));
      expect(defaultProps.onCurrencyChange).toHaveBeenCalledWith('USDC');
    });

    it('calls onCurrencyChange when USDT is selected', () => {
      render(
        <CryptoSelectorModal
          {...defaultProps}
          selectedCryptoCurrency="USDC"
          selectedCryptoChain="ETH"
        />,
      );
      fireEvent.click(screen.getByText('USDT'));
      expect(defaultProps.onCurrencyChange).toHaveBeenCalledWith('USDT');
    });

    it('calls onChainChange when a chain is selected', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      fireEvent.click(screen.getByText('ETH'));
      expect(defaultProps.onChainChange).toHaveBeenCalledWith('ETH');
    });

    it('calls onInitialize when continue button is clicked', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      const continueButton = screen.getByRole('button', {
        name: /continue with usdt on trx/i,
      });
      fireEvent.click(continueButton);
      expect(defaultProps.onInitialize).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find((button) =>
        button.querySelector('svg')?.classList.contains('lucide-x'),
      );
      if (closeButton) fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('disables continue button when initializing', () => {
      render(
        <CryptoSelectorModal {...defaultProps} isInitializingCrypto={true} />,
      );
      const continueButton = screen.getByRole('button', {
        name: /generating address/i,
      });
      expect(continueButton).toBeDisabled();
    });

    it('shows loading text when initializing', () => {
      render(
        <CryptoSelectorModal {...defaultProps} isInitializingCrypto={true} />,
      );
      expect(screen.getByText('Generating Address...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('renders modal with proper backdrop', () => {
      const { container } = render(
        <CryptoSelectorModal {...defaultProps} />,
      );
      const backdrop = container.querySelector('.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
    });

    it('has all interactive buttons with proper type attribute', () => {
      render(<CryptoSelectorModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      for (const button of buttons) {
        expect(button).toHaveAttribute('type', 'button');
      }
    });
  });
});
