type ContactTouchedFields = Partial<
  Record<'email' | 'firstName' | 'lastName' | 'phone', boolean>
>;

export function shouldAutoCollapseCheckoutContact({
  hasInitialContactIdentity,
  isContactComplete,
  touchedFields,
  wasContactComplete,
}: {
  hasInitialContactIdentity: boolean;
  isContactComplete: boolean;
  touchedFields: ContactTouchedFields;
  wasContactComplete: boolean;
}): boolean {
  if (!isContactComplete || wasContactComplete) return false;
  if (hasInitialContactIdentity) return true;
  return Boolean(
    touchedFields.email &&
      touchedFields.firstName &&
      touchedFields.lastName &&
      touchedFields.phone
  );
}
