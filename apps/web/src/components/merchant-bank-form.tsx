'use client';

import { MerchantBankFormContent } from './merchant-bank-form-content';
import type { MerchantBankFormProps } from './merchant-bank-form-types';

export type {
  BankFormInput,
  MerchantBankFormInitialData,
  MerchantBankFormProps,
  MerchantBankFormSavedValues,
} from './merchant-bank-form-types';

/**
 * A merchant change is a tenancy boundary. Keying the stateful content forces
 * React Hook Form and verification state to mount with the new merchant's
 * values before that merchant's first committed render can accept a save.
 */
export function MerchantBankForm(props: MerchantBankFormProps) {
  return <MerchantBankFormContent key={props.merchantId} {...props} />;
}
