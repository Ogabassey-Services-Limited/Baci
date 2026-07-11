import type { ReactElement } from 'react';
import type Colors from '@/constants/Colors';
import { PaymentMethodOptionRow } from './PaymentMethodOptionRow';
import type { PaymentMethod, PaymentMethodType } from './types';

type ThemeColors = (typeof Colors)['light'];

interface InstrumentRowsProps {
  colors: ThemeColors;
  methods: PaymentMethod[];
  selectedMethod: PaymentMethodType | null;
  /** Wallet fully covers the order and is active — gateway rows go informational. */
  walletSuppressesGateway: boolean;
  /** Device savings fully covers the order and is active. */
  savingsSuppressesGateway: boolean;
  suppressedSelectedMethods: PaymentMethodType[];
  onSelectMethod: (method: PaymentMethodType) => void;
  methodBadgeOverrides: Partial<Record<PaymentMethodType, string>>;
  methodDescriptionOverrides: Partial<Record<PaymentMethodType, string>>;
  methodLabelOverrides: Partial<Record<PaymentMethodType, string>>;
}

/**
 * The selectable payment-instrument rows for the currently expanded intent
 * (card/transfer under "Pay in Full", BNPL providers under "Pay Small Small").
 * Presentation only — selection and suppression are decided by the parent.
 */
export function InstrumentRows({
  colors,
  methods,
  selectedMethod,
  walletSuppressesGateway,
  savingsSuppressesGateway,
  suppressedSelectedMethods,
  onSelectMethod,
  methodBadgeOverrides,
  methodDescriptionOverrides,
  methodLabelOverrides,
}: InstrumentRowsProps): ReactElement {
  return (
    <>
      {methods.map((method) => {
        const selectionSuppressed = suppressedSelectedMethods.includes(
          method.id
        );
        const isSelected =
          selectedMethod === method.id &&
          !walletSuppressesGateway &&
          !savingsSuppressesGateway &&
          !selectionSuppressed;
        const isDisabled = Boolean(
          method.disabled || walletSuppressesGateway || savingsSuppressesGateway
        );
        return (
          <PaymentMethodOptionRow
            key={method.id}
            colors={colors}
            isDisabled={isDisabled}
            isSelected={isSelected}
            method={method}
            nested
            onPress={onSelectMethod}
            overrideBadge={methodBadgeOverrides[method.id]}
            overrideDescription={methodDescriptionOverrides[method.id]}
            overrideLabel={methodLabelOverrides[method.id]}
          />
        );
      })}
    </>
  );
}
