import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderSummarySidebar } from './OrderSummarySidebar';
import type { PaymentMethod, ResumedOrder } from '../types';

describe('OrderSummarySidebar', () => {
  const mockHandlePlaceOrder = vi.fn();
  const mockSetPayWithWallet = vi.fn();
  const mockSetNewsletterOptIn = vi.fn();

  const defaultProps = {
    items: [
      {
        cartItemId: 'item-1',
        name: 'Product 1',
        quantity: 2,
        price: 5000,
        image: '/product1.jpg',
      },
      {
        cartItemId: 'item-2',
        name: 'Product 2',
        quantity: 1,
        price: 10000,
        image: '/product2.jpg',
      },
    ],
    resumedOrder: null,
    cartTotal: 20000,
    deliveryCost: 2000,
    remainingAmount: 22000,
    walletAmountUsed: 0,
    orderTotals: { total: 22000, taxAmount: 0 },
    taxRate: 0,
    deliveryMethod: 'door' as const,
    selectedQuoteId: 'quote-123',
    giftWrappingCost: 0,
    walletLoading: false,
    walletBalance: 0,
    payWithWallet: false,
    setPayWithWallet: mockSetPayWithWallet,
    user: null,
    newsletterOptIn: false,
    setNewsletterOptIn: mockSetNewsletterOptIn,
    paymentMethod: '' as PaymentMethod,
    isProcessing: false,
    isPayForMeValid: false,
    handlePlaceOrder: mockHandlePlaceOrder,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Order Items Rendering', () => {
    it('renders all order items with correct names and quantities', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.getByText('Product 1')).toBeInTheDocument();
      expect(screen.getByText('Product 2')).toBeInTheDocument();
      expect(screen.getByText('Qty: 2')).toBeInTheDocument();
      expect(screen.getByText('Qty: 1')).toBeInTheDocument();
    });

    it('displays correct prices for each item', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.getByText('₦5,000')).toBeInTheDocument();
      expect(screen.getByText('₦10,000')).toBeInTheDocument();
    });

    it('uses negotiated price over regular price when available', () => {
      // Arrange
      const propsWithNegotiation = {
        ...defaultProps,
        items: [
          {
            cartItemId: 'item-1',
            name: 'Negotiated Product',
            quantity: 1,
            price: 10000,
            negotiatedPrice: 8000,
          },
        ],
      };

      render(<OrderSummarySidebar {...propsWithNegotiation} />);

      // Assert
      expect(screen.getByText('₦8,000')).toBeInTheDocument();
      expect(screen.queryByText('₦10,000')).not.toBeInTheDocument();
    });

    it('uses product_name when name is not available', () => {
      // Arrange
      const propsWithProductName = {
        ...defaultProps,
        items: [
          {
            id: 'prod-1',
            product_name: 'Product Name Field',
            quantity: 1,
            price: 5000,
          },
        ],
      };

      render(<OrderSummarySidebar {...propsWithProductName} />);

      // Assert
      expect(screen.getByText('Product Name Field')).toBeInTheDocument();
    });

    it('displays resumed order items when cart items are empty', () => {
      // Arrange
      const resumedOrder: ResumedOrder = {
        id: 'order-1',
        short_id: 'ORD-123',
        subtotal: 15000,
        shipping_cost: 2000,
        total: 17000,
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        customer_phone: '+2348012345678',
        shipping_address: {
          address: '123 Main St',
          city: 'Lagos',
          state: 'Lagos',
          phone: '+2348012345678',
        },
        items: [
          {
            id: 'item-1',
            product_id: 'prod-1',
            product_name: 'Resumed Product',
            quantity: 1,
            price: 15000,
            image_url: '/resumed.jpg',
          },
        ],
      };

      const propsWithResumedOrder = {
        ...defaultProps,
        items: [],
        resumedOrder,
      };

      render(<OrderSummarySidebar {...propsWithResumedOrder} />);

      // Assert
      expect(screen.getByText('Resumed Product')).toBeInTheDocument();
    });
  });

  describe('Pricing Breakdown', () => {
    it('displays subtotal correctly', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.getByText('Subtotal')).toBeInTheDocument();
      expect(screen.getByText('₦20,000')).toBeInTheDocument();
    });

    it('displays delivery cost correctly', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('₦2,000')).toBeInTheDocument();
    });

    it('shows "Free" for zero delivery cost with selected quote', () => {
      // Arrange
      const propsWithFreeDelivery = {
        ...defaultProps,
        deliveryCost: 0,
        selectedQuoteId: 'quote-123',
      };

      render(<OrderSummarySidebar {...propsWithFreeDelivery} />);

      // Assert
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('shows "Calculated..." for door delivery without selected quote', () => {
      // Arrange
      const propsWithCalculating = {
        ...defaultProps,
        deliveryCost: 0,
        deliveryMethod: 'door' as const,
        selectedQuoteId: '',
      };

      render(<OrderSummarySidebar {...propsWithCalculating} />);

      // Assert
      expect(screen.getByText('Calculated...')).toBeInTheDocument();
    });

    it('displays total amount correctly', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('₦22,000')).toBeInTheDocument();
    });

    it('displays gift wrapping cost when greater than zero', () => {
      // Arrange
      const propsWithGiftWrapping = {
        ...defaultProps,
        giftWrappingCost: 500,
      };

      render(<OrderSummarySidebar {...propsWithGiftWrapping} />);

      // Assert
      expect(screen.getByText('Gift Wrapping')).toBeInTheDocument();
      expect(screen.getByText('₦500')).toBeInTheDocument();
    });

    it('does not display gift wrapping when cost is zero', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.queryByText('Gift Wrapping')).not.toBeInTheDocument();
    });
  });

  describe('VAT Display', () => {
    it('shows VAT when taxRate is greater than zero', () => {
      // Arrange
      const propsWithTax = {
        ...defaultProps,
        taxRate: 0.075,
        orderTotals: { total: 23650, taxAmount: 1650 },
      };

      render(<OrderSummarySidebar {...propsWithTax} />);

      // Assert
      expect(screen.getByText('VAT (7.5%)')).toBeInTheDocument();
      expect(screen.getByText('₦1,650')).toBeInTheDocument();
    });

    it('does not show VAT when taxRate is zero', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.queryByText(/VAT/)).not.toBeInTheDocument();
    });

    it('formats VAT percentage with one decimal place', () => {
      // Arrange
      const propsWithTax = {
        ...defaultProps,
        taxRate: 0.15,
        orderTotals: { total: 25300, taxAmount: 3300 },
      };

      render(<OrderSummarySidebar {...propsWithTax} />);

      // Assert
      expect(screen.getByText('VAT (15.0%)')).toBeInTheDocument();
    });
  });

  describe('Wallet Credit Section', () => {
    it('shows wallet section when user is logged in and walletBalance is greater than zero', () => {
      // Arrange
      const propsWithWallet = {
        ...defaultProps,
        user: { id: 'user-123' },
        walletBalance: 5000,
      };

      render(<OrderSummarySidebar {...propsWithWallet} />);

      // Assert
      expect(screen.getByText('Wallet Credit')).toBeInTheDocument();
      expect(screen.getByText('(₦5,000 available)')).toBeInTheDocument();
    });

    it('does not show wallet section when user is not logged in', () => {
      // Arrange
      const propsWithWallet = {
        ...defaultProps,
        user: null,
        walletBalance: 5000,
      };

      render(<OrderSummarySidebar {...propsWithWallet} />);

      // Assert
      expect(screen.queryByText('Wallet Credit')).not.toBeInTheDocument();
    });

    it('does not show wallet section when walletBalance is zero and not loading', () => {
      // Arrange
      const propsWithNoBalance = {
        ...defaultProps,
        user: { id: 'user-123' },
        walletBalance: 0,
        walletLoading: false,
      };

      render(<OrderSummarySidebar {...propsWithNoBalance} />);

      // Assert
      expect(screen.queryByText('Wallet Credit')).not.toBeInTheDocument();
    });

    it('shows loading state when checking wallet balance', () => {
      // Arrange
      const propsWithLoading = {
        ...defaultProps,
        user: { id: 'user-123' },
        walletLoading: true,
      };

      render(<OrderSummarySidebar {...propsWithLoading} />);

      // Assert
      expect(screen.getByText('Checking wallet balance...')).toBeInTheDocument();
    });

    it('toggles wallet credit when toggle button is clicked', () => {
      // Arrange
      const propsWithWallet = {
        ...defaultProps,
        user: { id: 'user-123' },
        walletBalance: 5000,
        payWithWallet: false,
      };

      render(<OrderSummarySidebar {...propsWithWallet} />);

      // Act
      const toggleButton = screen.getByRole('switch', { name: 'Use Wallet Credit' });
      fireEvent.click(toggleButton);

      // Assert
      expect(mockSetPayWithWallet).toHaveBeenCalledTimes(1);
      expect(mockSetPayWithWallet).toHaveBeenCalledWith(true);
    });

    it('toggles wallet credit off when already enabled', () => {
      // Arrange
      const propsWithWalletEnabled = {
        ...defaultProps,
        user: { id: 'user-123' },
        walletBalance: 5000,
        payWithWallet: true,
      };

      render(<OrderSummarySidebar {...propsWithWalletEnabled} />);

      // Act
      const toggleButton = screen.getByRole('switch', { name: 'Use Wallet Credit' });
      fireEvent.click(toggleButton);

      // Assert
      expect(mockSetPayWithWallet).toHaveBeenCalledTimes(1);
      expect(mockSetPayWithWallet).toHaveBeenCalledWith(false);
    });

    it('shows applied credit amount when wallet is enabled and amount is used', () => {
      // Arrange
      const propsWithAppliedCredit = {
        ...defaultProps,
        user: { id: 'user-123' },
        walletBalance: 5000,
        payWithWallet: true,
        walletAmountUsed: 5000,
        remainingAmount: 17000,
      };

      render(<OrderSummarySidebar {...propsWithAppliedCredit} />);

      // Assert
      expect(screen.getByText('Applied Credit')).toBeInTheDocument();
      expect(screen.getByText('-₦5,000')).toBeInTheDocument();
    });

    it('changes total label to "Amount Due" when wallet credit is applied', () => {
      // Arrange
      const propsWithWalletApplied = {
        ...defaultProps,
        user: { id: 'user-123' },
        walletBalance: 5000,
        payWithWallet: true,
        walletAmountUsed: 5000,
        remainingAmount: 17000,
      };

      render(<OrderSummarySidebar {...propsWithWalletApplied} />);

      // Assert
      expect(screen.getByText('Amount Due')).toBeInTheDocument();
      expect(screen.queryByText('Total')).not.toBeInTheDocument();
    });
  });

  describe('Newsletter Opt-in', () => {
    it('shows newsletter checkbox when user is not logged in', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(
        screen.getByRole('checkbox', {
          name: /Email me with exclusive offers/i,
        })
      ).toBeInTheDocument();
    });

    it('does not show newsletter checkbox when user is logged in', () => {
      // Arrange
      const propsWithUser = {
        ...defaultProps,
        user: { id: 'user-123' },
      };

      render(<OrderSummarySidebar {...propsWithUser} />);

      // Assert
      expect(
        screen.queryByRole('checkbox', {
          name: /Email me with exclusive offers/i,
        })
      ).not.toBeInTheDocument();
    });

    it('toggles newsletter opt-in when checkbox is clicked', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Act
      const checkbox = screen.getByRole('checkbox', {
        name: /Email me with exclusive offers/i,
      });
      fireEvent.click(checkbox);

      // Assert
      expect(mockSetNewsletterOptIn).toHaveBeenCalledTimes(1);
      expect(mockSetNewsletterOptIn).toHaveBeenCalledWith(true);
    });

    it('reflects newsletterOptIn state in checkbox', () => {
      // Arrange
      const propsWithOptIn = {
        ...defaultProps,
        newsletterOptIn: true,
      };

      render(<OrderSummarySidebar {...propsWithOptIn} />);

      // Assert
      const checkbox = screen.getByRole('checkbox', {
        name: /Email me with exclusive offers/i,
      }) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Place Order Button', () => {
    it('renders place order button with correct default text', () => {
      // Arrange
      const propsWithPayment = {
        ...defaultProps,
        paymentMethod: 'paystack' as PaymentMethod,
      };

      render(<OrderSummarySidebar {...propsWithPayment} />);

      // Assert
      expect(
        screen.getByRole('button', { name: /Place Order/i })
      ).toBeInTheDocument();
    });

    it('shows "Generate Invoice" text when payment method is invoice', () => {
      // Arrange
      const propsWithInvoice = {
        ...defaultProps,
        paymentMethod: 'invoice' as PaymentMethod,
      };

      render(<OrderSummarySidebar {...propsWithInvoice} />);

      // Assert
      expect(
        screen.getByRole('button', { name: /Generate Invoice/i })
      ).toBeInTheDocument();
    });

    it('shows "Send Payment Link" text when payment method is payforme', () => {
      // Arrange
      const propsWithPayForMe = {
        ...defaultProps,
        paymentMethod: 'payforme' as PaymentMethod,
        isPayForMeValid: true,
      };

      render(<OrderSummarySidebar {...propsWithPayForMe} />);

      // Assert
      expect(
        screen.getByRole('button', { name: /Send Payment Link/i })
      ).toBeInTheDocument();
    });

    it('disables button when no payment method is selected and remaining amount is greater than zero', () => {
      // Arrange
      const propsWithoutPayment = {
        ...defaultProps,
        paymentMethod: '' as PaymentMethod,
        remainingAmount: 22000,
      };

      render(<OrderSummarySidebar {...propsWithoutPayment} />);

      // Assert
      const button = screen.getByRole('button', { name: /Place Order/i });
      expect(button).toBeDisabled();
    });

    it('disables button when payment method is payforme and isPayForMeValid is false', () => {
      // Arrange
      const propsWithInvalidPayForMe = {
        ...defaultProps,
        paymentMethod: 'payforme' as PaymentMethod,
        isPayForMeValid: false,
      };

      render(<OrderSummarySidebar {...propsWithInvalidPayForMe} />);

      // Assert
      const button = screen.getByRole('button', {
        name: /Send Payment Link/i,
      });
      expect(button).toBeDisabled();
    });

    it('enables button when payment method is selected', () => {
      // Arrange
      const propsWithPayment = {
        ...defaultProps,
        paymentMethod: 'paystack' as PaymentMethod,
      };

      render(<OrderSummarySidebar {...propsWithPayment} />);

      // Assert
      const button = screen.getByRole('button', { name: /Place Order/i });
      expect(button).not.toBeDisabled();
    });

    it('disables button when processing', () => {
      // Arrange
      const propsProcessing = {
        ...defaultProps,
        paymentMethod: 'paystack' as PaymentMethod,
        isProcessing: true,
      };

      render(<OrderSummarySidebar {...propsProcessing} />);

      // Assert
      const button = screen.getByRole('button', { name: '' });
      expect(button).toBeDisabled();
    });

    it('calls handlePlaceOrder when button is clicked', () => {
      // Arrange
      const propsWithPayment = {
        ...defaultProps,
        paymentMethod: 'paystack' as PaymentMethod,
      };

      render(<OrderSummarySidebar {...propsWithPayment} />);

      // Act
      const button = screen.getByRole('button', { name: /Place Order/i });
      fireEvent.click(button);

      // Assert
      expect(mockHandlePlaceOrder).toHaveBeenCalledTimes(1);
    });

    it('enables button when remaining amount is zero regardless of payment method', () => {
      // Arrange
      const propsWithZeroAmount = {
        ...defaultProps,
        paymentMethod: '' as PaymentMethod,
        remainingAmount: 0,
      };

      render(<OrderSummarySidebar {...propsWithZeroAmount} />);

      // Assert
      const button = screen.getByRole('button', { name: /Place Order/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing image URLs gracefully', () => {
      // Arrange
      const propsWithoutImages = {
        ...defaultProps,
        items: [
          {
            cartItemId: 'item-1',
            name: 'Product Without Image',
            quantity: 1,
            price: 5000,
          },
        ],
      };

      render(<OrderSummarySidebar {...propsWithoutImages} />);

      // Assert
      const productImage = screen.getByRole('img', {
        name: 'Product Without Image',
      });
      expect(productImage).toHaveAttribute(
        'src',
        'https://placehold.co/600x600/f4f4f5/a1a1aa?text=No+Image'
      );
    });

    it('formats large numbers with commas correctly', () => {
      // Arrange
      const propsWithLargeNumbers = {
        ...defaultProps,
        items: [
          {
            cartItemId: 'item-1',
            name: 'Expensive Product',
            quantity: 1,
            price: 1500000,
          },
        ],
        cartTotal: 1500000,
        deliveryCost: 50000,
        remainingAmount: 1550000,
      };

      render(<OrderSummarySidebar {...propsWithLargeNumbers} />);

      // Assert
      const allPrices = screen.getAllByText('₦1,500,000');
      expect(allPrices.length).toBeGreaterThan(0);
      expect(screen.getByText('₦50,000')).toBeInTheDocument();
      expect(screen.getByText('₦1,550,000')).toBeInTheDocument();
    });

    it('renders correctly with empty items and no resumed order', () => {
      // Arrange
      const propsWithNoItems = {
        ...defaultProps,
        items: [],
        resumedOrder: null,
      };

      render(<OrderSummarySidebar {...propsWithNoItems} />);

      // Assert
      expect(screen.getByText('Order Summary')).toBeInTheDocument();
      expect(screen.getByText('Subtotal')).toBeInTheDocument();
    });
  });

  describe('Security Features', () => {
    it('displays security badge at bottom', () => {
      // Arrange
      render(<OrderSummarySidebar {...defaultProps} />);

      // Assert
      expect(screen.getByText('Secure Encrypted Payment')).toBeInTheDocument();
    });
  });
});
