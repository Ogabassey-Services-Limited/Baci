import {
  type SavedAddress,
  upsertSavedAddress,
} from '@/lib/checkout-saved-address';
import { supabase } from '@/lib/supabase';
import type { ShippingAddressInput } from '@/lib/validation';
import { trackError } from '@/services/analytics';
import { CHECKOUT_MERCHANT_ID } from './checkout-screen.constants';

interface RunPostOrderSideEffectsParams {
  accountPassword: string;
  address: ShippingAddressInput;
  customerEmail: string;
  customerId?: string;
  isAuthenticated: boolean;
  saveAsDefaultAddress: boolean;
  saveDetails: boolean;
  selectedSavedAddressId: string | null;
}

export async function runCheckoutPostOrderSideEffects({
  accountPassword,
  address,
  customerEmail,
  customerId,
  isAuthenticated,
  saveAsDefaultAddress,
  saveDetails,
  selectedSavedAddressId,
}: RunPostOrderSideEffectsParams) {
  if (isAuthenticated && customerId && saveAsDefaultAddress) {
    await saveDefaultCheckoutAddress({
      address,
      customerId,
      selectedSavedAddressId,
    });
  }

  if (!isAuthenticated && saveDetails && accountPassword.length >= 6) {
    try {
      await supabase.auth.signUp({
        email: customerEmail,
        password: accountPassword,
        options: {
          data: {
            first_name: address.firstName,
            last_name: address.lastName,
            phone: address.phone,
          },
        },
      });
    } catch {
      // Non-blocking: order already placed, account creation is best-effort.
    }
  }
}

async function saveDefaultCheckoutAddress({
  address,
  customerId,
  selectedSavedAddressId,
}: Pick<
  RunPostOrderSideEffectsParams,
  'address' | 'customerId' | 'selectedSavedAddressId'
>) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('saved_addresses')
      .eq('id', customerId)
      .eq('merchant_id', CHECKOUT_MERCHANT_ID)
      .single();

    if (error) throw error;

    const nextSavedAddresses = upsertSavedAddress(
      Array.isArray(data?.saved_addresses)
        ? (data.saved_addresses as SavedAddress[])
        : [],
      address,
      {
        selectedSavedAddressId,
        setAsDefault: true,
      }
    );

    const { error: updateError } = await supabase
      .from('customers')
      .update({ saved_addresses: nextSavedAddresses })
      .eq('id', customerId)
      .eq('merchant_id', CHECKOUT_MERCHANT_ID);

    if (updateError) throw updateError;
  } catch (error) {
    trackError(
      'checkout_save_default_address',
      error instanceof Error ? error.message : 'Failed to save default address'
    );
  }
}
