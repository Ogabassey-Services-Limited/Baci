import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShipping } from './use-shipping';
import type { SavedAddress } from '../types';

const defaultProps = {
  deliveryMethod: 'pickup' as const,
  isNewAddressMode: true,
  newAddressState: '',
  newAddressCity: '',
  newAddressStreet: '',
  customerPhone: '',
  firstName: '',
  lastName: '',
  customerEmail: '',
  selectedAddressId: 0,
  addresses: [],
  cart: [],
};

describe('useShipping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('State fetching', () => {
    it('fetches states on mount', async () => {
      // Arrange
      const mockStates = ['Lagos', 'Abuja', 'Rivers'];
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: mockStates }),
      });

      // Act
      const { result } = renderHook(() => useShipping(defaultProps));

      // Assert
      expect(result.current.isLoadingLocations).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/shipping/locations');
      expect(result.current.shippingStates).toEqual(mockStates);
    });

    it('handles state fetch failure gracefully', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );

      // Act
      const { result } = renderHook(() => useShipping(defaultProps));

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch states',
        expect.any(Error),
      );
      expect(result.current.shippingStates).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('handles non-ok state fetch response', async () => {
      // Arrange
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      });

      // Act
      const { result } = renderHook(() => useShipping(defaultProps));

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      expect(result.current.shippingStates).toEqual([]);
    });
  });

  describe('City fetching', () => {
    it('fetches cities when newAddressState changes', async () => {
      // Arrange
      const mockLocations = [
        { city: 'Ikeja', state: 'Lagos' },
        { city: 'Lekki', state: 'Lagos' },
        { city: 'Victoria Island', state: 'Lagos' },
      ];
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: mockLocations }),
        });

      // Act
      const { result, rerender } = renderHook((props) => useShipping(props), {
        initialProps: defaultProps,
      });

      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      rerender({ ...defaultProps, newAddressState: 'Lagos' });

      // Assert
      await waitFor(() => {
        expect(result.current.shippingCities).toEqual(['Ikeja', 'Lekki', 'Victoria Island']);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/shipping/locations?state=Lagos',
      );
    });

    it('clears cities when newAddressState is empty', async () => {
      // Arrange
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: [] }),
        });

      // Act
      const { result, rerender } = renderHook((props) => useShipping(props), {
        initialProps: { ...defaultProps, newAddressState: 'Lagos' },
      });

      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      rerender({ ...defaultProps, newAddressState: '' });

      // Assert
      expect(result.current.shippingCities).toEqual([]);
    });

    it('handles city fetch failure gracefully', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      // Act
      const { result, rerender } = renderHook((props) => useShipping(props), {
        initialProps: defaultProps,
      });

      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      rerender({ ...defaultProps, newAddressState: 'Lagos' });

      // Assert
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch cities',
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('deduplicates and sorts cities', async () => {
      // Arrange
      const mockLocations = [
        { city: 'Lekki', state: 'Lagos' },
        { city: 'Ikeja', state: 'Lagos' },
        { city: 'Lekki', state: 'Lagos' },
      ];
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: mockLocations }),
        });

      // Act
      const { result, rerender } = renderHook((props) => useShipping(props), {
        initialProps: defaultProps,
      });

      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      rerender({ ...defaultProps, newAddressState: 'Lagos' });

      // Assert
      await waitFor(() => {
        expect(result.current.shippingCities).toEqual(['Ikeja', 'Lekki']);
      });
    });
  });

  describe('Shipping quote fetching - new address mode', () => {
    it('fetches quotes when deliveryMethod is door with new address', async () => {
      // Arrange
      const mockQuotes = [
        {
          id: 'quote-1',
          provider: 'GIGL',
          serviceTier: 'standard',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics',
          estimatedDays: 2,
          price: 2000,
          currency: 'NGN',
          pickupIncluded: false,
          insuranceIncluded: true,
        },
        {
          id: 'quote-2',
          provider: 'TOPSHIP',
          serviceTier: 'standard',
          carrierName: 'Topship',
          displayName: 'Topship',
          estimatedDays: 3,
          price: 2500,
          currency: 'NGN',
          pickupIncluded: false,
          insuranceIncluded: true,
        },
      ];
      const cart = [
        { name: 'Product 1', quantity: 2, price: 5000 },
        { name: 'Product 2', quantity: 1, price: 3000, negotiatedPrice: 2800 },
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ quotes: { all: mockQuotes } }),
        });

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          isNewAddressMode: true,
          newAddressState: 'Lagos',
          newAddressCity: 'Ikeja',
          newAddressStreet: '123 Main St',
          customerPhone: '08012345678',
          firstName: 'John',
          lastName: 'Doe',
          customerEmail: 'john@example.com',
          cart,
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingQuotes).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/shipping/quotes',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiver: {
              name: 'John Doe',
              email: 'john@example.com',
              phone: '08012345678',
              address: '123 Main St',
              city: 'Ikeja',
              state: 'Lagos',
              country: 'Nigeria',
            },
            items: [
              { name: 'Product 1', quantity: 2, weight: 1, value: 5000 },
              { name: 'Product 2', quantity: 1, weight: 1, value: 2800 },
            ],
          }),
        }),
      );

      expect(result.current.shippingQuotes).toEqual(mockQuotes);
      expect(result.current.selectedQuoteId).toBe('quote-1');
    });

    it('does not fetch quotes when deliveryMethod is pickup', async () => {
      // Arrange
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: [] }),
        });

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'pickup',
          newAddressState: 'Lagos',
          newAddressCity: 'Ikeja',
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(2); // States + cities fetch
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/shipping/quotes',
        expect.any(Object),
      );
    });

    it('does not fetch quotes when state is missing', async () => {
      // Arrange
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [] }),
      });

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          newAddressState: '',
          newAddressCity: 'Ikeja',
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1); // Only states fetch
    });

    it('does not fetch quotes when city is missing', async () => {
      // Arrange
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: [] }),
        });

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          newAddressState: 'Lagos',
          newAddressCity: '',
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingLocations).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(2); // States + cities fetch
    });

    it('uses default values for missing customer info', async () => {
      // Arrange
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ quotes: { all: [] } }),
        });

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          newAddressState: 'Lagos',
          newAddressCity: 'Ikeja',
          firstName: '',
          lastName: '',
          customerEmail: '',
          customerPhone: '',
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingQuotes).toBe(false);
      });

      const quoteCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === '/api/shipping/quotes',
      );
      expect(quoteCall).toBeDefined();
      const body = JSON.parse(quoteCall![1].body);
      expect(body.receiver.name).toBe('Valued Customer');
      expect(body.receiver.email).toBe('guest@example.com');
      expect(body.receiver.phone).toBe('');
    });
  });

  describe('Shipping quote fetching - saved address mode', () => {
    it('fetches quotes with saved address when not in new address mode', async () => {
      // Arrange
      const savedAddresses: SavedAddress[] = [
        {
          id: 1,
          label: 'Home',
          address: 'Address 1, Ikeja, Lagos',
          phone: '08011111111',
          isDefault: false,
        },
        {
          id: 2,
          label: 'Work',
          address: 'Address 2, Lekki, Lagos',
          phone: '08022222222',
          isDefault: true,
        },
      ];

      const mockQuotes = [
        {
          id: 'quote-1',
          provider: 'GIGL',
          serviceTier: 'standard',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics',
          estimatedDays: 2,
          price: 2000,
          currency: 'NGN',
          pickupIncluded: false,
          insuranceIncluded: true,
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ quotes: { all: mockQuotes } }),
        });

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          isNewAddressMode: false,
          selectedAddressId: 2,
          addresses: savedAddresses,
          firstName: 'Jane',
          lastName: 'Smith',
          customerEmail: 'jane@example.com',
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingQuotes).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/shipping/quotes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            receiver: {
              name: 'Jane Smith',
              email: 'jane@example.com',
              phone: '08022222222',
              address: 'Address 2, Lekki, Lagos',
              city: 'Lekki',
              state: 'Lagos',
              country: 'Nigeria',
            },
            items: [],
          }),
        }),
      );
    });

    it('does not fetch quotes for saved address with insufficient parts', async () => {
      // Arrange
      const savedAddresses: SavedAddress[] = [
        {
          id: 1,
          label: 'Home',
          address: 'Lagos', // Only one part
          phone: '08011111111',
          isDefault: true,
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ states: [] }),
      });

      // Act
      renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          isNewAddressMode: false,
          selectedAddressId: 1,
          addresses: savedAddresses,
        }),
      );

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1); // Only states fetch
      });
    });

    it('does not fetch quotes when saved address is not found', async () => {
      // Arrange
      const savedAddresses: SavedAddress[] = [
        {
          id: 1,
          label: 'Home',
          address: 'Address 1, Ikeja, Lagos',
          phone: '08011111111',
          isDefault: true,
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ states: [] }),
      });

      // Act
      renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          isNewAddressMode: false,
          selectedAddressId: 999, // Non-existent ID
          addresses: savedAddresses,
        }),
      );

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1); // Only states fetch
      });
    });
  });

  describe('Quote fetch error handling', () => {
    it('handles quote fetch failure gracefully', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          newAddressState: 'Lagos',
          newAddressCity: 'Ikeja',
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingQuotes).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching shipping quotes:',
        expect.any(Error),
      );
      expect(result.current.shippingQuotes).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('handles non-ok quote fetch response', async () => {
      // Arrange
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ states: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ locations: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Bad Request',
        });

      // Act
      const { result } = renderHook(() =>
        useShipping({
          ...defaultProps,
          deliveryMethod: 'door',
          newAddressState: 'Lagos',
          newAddressCity: 'Ikeja',
        }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoadingQuotes).toBe(false);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch quotes:',
        'Bad Request',
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
