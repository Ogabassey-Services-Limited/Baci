import type { ShippingAddressInput } from '@/lib/validation';
import { ShippingAddressSchema } from '@/lib/validation';

type CheckoutContactFields = Partial<
  Pick<ShippingAddressInput, 'email' | 'firstName' | 'lastName' | 'phone'>
>;

const checkoutContactSchema = ShippingAddressSchema.pick({
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
});

export function isCheckoutContactComplete(
  fields: CheckoutContactFields
): boolean {
  return checkoutContactSchema.safeParse(fields).success;
}
