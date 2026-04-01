'use client';

export function PaymentDisplay({ provider }: { provider?: string }) {
  if (!provider) return <span>Not Specified</span>;
  const normalizedProvider = provider.toLowerCase();

  let backgroundColor = 'bg-gray-100';
  let textColor = 'text-gray-800';

  if (normalizedProvider.includes('paystack')) {
    backgroundColor = 'bg-blue-50';
    textColor = 'text-blue-700';
  } else if (
    normalizedProvider.includes('credpal') ||
    normalizedProvider.includes('credit')
  ) {
    backgroundColor = 'bg-purple-50';
    textColor = 'text-purple-700';
  } else if (normalizedProvider.includes('kora')) {
    backgroundColor = 'bg-green-50';
    textColor = 'text-green-700';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${backgroundColor} ${textColor}`}
    >
      {provider}
    </span>
  );
}
