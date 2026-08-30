import type { ShippingAddressInput } from '@/lib/validation';
import { ShippingAddressSchema } from '@/lib/validation';

type CheckoutContactFields = Partial<
  Pick<ShippingAddressInput, 'email' | 'firstName' | 'lastName' | 'phone'>
>;

type CheckoutContactFieldName = keyof CheckoutContactFields;
type ContactFieldFlags = Partial<
  Record<CheckoutContactFieldName, boolean | undefined>
>;

const CHECKOUT_CONTACT_FIELD_NAMES = [
  'email',
  'firstName',
  'lastName',
  'phone',
] as const satisfies readonly CheckoutContactFieldName[];

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

export function areCheckoutContactFieldsSettled({
  dirtyFields,
  touchedFields,
}: {
  dirtyFields: ContactFieldFlags;
  touchedFields: ContactFieldFlags;
}): boolean {
  return CHECKOUT_CONTACT_FIELD_NAMES.every(
    (field) => !dirtyFields[field] || Boolean(touchedFields[field])
  );
}
