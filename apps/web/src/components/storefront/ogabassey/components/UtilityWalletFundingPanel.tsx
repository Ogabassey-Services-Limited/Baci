'use client';

import type { ComponentProps } from 'react';
import { useOptionalCustomerAuth } from '@/contexts/customer-auth-context';
import { WalletFundingPanel } from './WalletFundingPanel';

type UtilityWalletFundingPanelProps = Omit<
  ComponentProps<typeof WalletFundingPanel>,
  'onUpdateCustomerPhone'
>;

/**
 * Utility-modal wiring for point-of-need customer phone persistence.
 * Keeping the auth callback beside the funding panel keeps UtilityModal below
 * the repository's 300-line component limit.
 */
export function UtilityWalletFundingPanel(
  props: UtilityWalletFundingPanelProps
) {
  const auth = useOptionalCustomerAuth();
  const onUpdateCustomerPhone = auth?.updateCustomer
    ? (phone: string) => auth.updateCustomer({ phone })
    : undefined;

  return (
    <div className="mt-3">
      <WalletFundingPanel
        {...props}
        onUpdateCustomerPhone={onUpdateCustomerPhone}
      />
    </div>
  );
}
