export function initialMerchantSetupStep(
  firstName: string,
  lastName: string
): 1 | 2 {
  return firstName.trim() && lastName.trim() ? 2 : 1;
}
