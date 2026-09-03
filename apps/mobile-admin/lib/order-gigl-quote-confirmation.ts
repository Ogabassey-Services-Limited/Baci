export function resolveOrderGiglQuoteConfirmationGate(input: {
  confirmationInFlight: boolean;
  preview: boolean;
  quoteBound: boolean;
  hasQuote: boolean;
  canBook: boolean;
  quoteFresh: boolean;
}): 'deny' | 'allow' | 'refresh' {
  if (
    input.confirmationInFlight ||
    input.preview ||
    !input.quoteBound ||
    !input.hasQuote ||
    !input.canBook
  ) {
    return 'deny';
  }
  return input.quoteFresh ? 'allow' : 'refresh';
}
