/**
 * Displays the payment provider as a themed badge.
 * Uses neutral gray tones that work with any merchant theme.
 */
export function PaymentDisplay({ provider }: { provider?: string }) {
  if (!provider) return <span>Not Specified</span>;

  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-800">
      {provider}
    </span>
  );
}
