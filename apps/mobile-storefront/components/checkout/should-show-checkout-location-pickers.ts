interface ShouldShowCheckoutLocationPickersParams {
  address: string;
  city: string;
  hasCoordinates: boolean;
  state: string;
}

export function shouldShowCheckoutLocationPickers({
  address,
  city,
  hasCoordinates,
  state,
}: ShouldShowCheckoutLocationPickersParams): boolean {
  return Boolean(
    address.trim() && (!hasCoordinates || !city.trim() || !state.trim())
  );
}
