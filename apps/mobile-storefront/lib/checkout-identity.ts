import type { User } from '@supabase/supabase-js';
import { splitFullName } from './auth-helpers';
import type { Customer } from '../stores/auth-store';

export interface CheckoutIdentity {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function readMetadataString(
  metadata: User['user_metadata'] | undefined,
  key: string
): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function deriveCheckoutIdentity({
  customer,
  user,
}: {
  customer: Customer | null;
  user: User | null;
}): CheckoutIdentity {
  const metadata = user?.user_metadata;
  const splitName = splitFullName(readMetadataString(metadata, 'full_name'));

  return {
    email: pickFirstNonEmpty(customer?.email, user?.email),
    firstName: pickFirstNonEmpty(
      customer?.first_name,
      readMetadataString(metadata, 'first_name'),
      splitName.firstName
    ),
    lastName: pickFirstNonEmpty(
      customer?.last_name,
      readMetadataString(metadata, 'last_name'),
      splitName.lastName
    ),
    phone: pickFirstNonEmpty(
      customer?.phone,
      readMetadataString(metadata, 'phone'),
      readMetadataString(metadata, 'phone_number')
    ),
  };
}
