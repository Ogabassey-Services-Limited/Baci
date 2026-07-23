import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UTILITY_PENDING_INTENT_STORAGE_KEY } from './use-utility-pending-intent';
import { utilityModalTestHarness as harness } from './utility-modal-test-support';
import { UtilityModal } from './UtilityModal';

/**
 * Resume of the utility purchase a wallet-funding detour interrupts. The
 * modal's checkout and rendering behaviour live in `UtilityModal.checkout.test`
 * and `UtilityModal.test`; kept separate for the 300-line modularity budget.
 */
const storedIntent = {
  amount: '500',
  networkProvider: 'MTN',
  phoneNumber: '08012345678',
  tab: 'airtime' as const,
};

function renderOpenModal() {
  return render(<UtilityModal isOpen={true} onClose={harness.onClose} />);
}

function storedIntentValue(): unknown {
  return JSON.parse(
    sessionStorage.getItem(UTILITY_PENDING_INTENT_STORAGE_KEY) ?? 'null'
  );
}

describe('UtilityModal funding-detour resume', () => {
  beforeEach(() => {
    harness.reset();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
  });

  describe('with the dark-launch flag off', () => {
    it('never prefills and never persists a draft', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(storedIntent)
      );

      renderOpenModal();

      expect(screen.getByTestId('airtime-data-form')).toHaveAttribute(
        'data-initial-amount',
        ''
      );
      expect(
        screen.queryByRole('button', { name: 'Mock Draft Change' })
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Mock Draft Change' }));
      expect(storedIntentValue()).toEqual(storedIntent);
    });
  });

  describe('with the dark-launch flag on', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'true');
    });

    it('prefills the paused purchase without auto-submitting it', () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(storedIntent)
      );

      renderOpenModal();

      const form = screen.getByTestId('airtime-data-form');
      expect(form).toHaveAttribute('data-initial-amount', '500');
      expect(form).toHaveAttribute('data-initial-phone', '08012345678');
      // Prefill only: no checkout call fires without the customer pressing Pay.
      expect(harness.checkoutFetch).not.toHaveBeenCalled();
    });

    it('persists the in-progress draft so it survives the funding detour', async () => {
      vi.useFakeTimers();
      renderOpenModal();

      act(() => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Mock Draft Change' })
        );
      });
      act(() => {
        // usePersistedState debounces its storage write by 300ms.
        vi.advanceTimersByTime(1_000);
      });

      expect(storedIntentValue()).toEqual({
        amount: '750',
        networkProvider: 'MTN',
        phoneNumber: '08012345678',
        tab: 'airtime',
      });
      vi.useRealTimers();
    });

    it('clears the resume snapshot once the purchase completes', async () => {
      sessionStorage.setItem(
        UTILITY_PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(storedIntent)
      );
      renderOpenModal();

      fireEvent.click(screen.getByRole('button', { name: 'Mock Submit' }));

      await waitFor(() => {
        expect(storedIntentValue()).toBeNull();
      });
    });
  });
});
