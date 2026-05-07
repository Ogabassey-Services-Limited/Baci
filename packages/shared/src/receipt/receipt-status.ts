export interface ReceiptStatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  watermark: string;
  wmBorder: string;
}

export function getReceiptStatusConfig(
  paymentStatus: string
): ReceiptStatusConfig {
  if (paymentStatus === 'paid') {
    return {
      label: 'PAID',
      color: '#059669',
      bg: 'rgba(5,150,105,0.06)',
      border: 'rgba(5,150,105,0.18)',
      watermark: 'rgba(5,150,105,0.07)',
      wmBorder: 'rgba(5,150,105,0.12)',
    };
  }

  if (paymentStatus === 'partially_paid') {
    return {
      label: 'PARTIALLY PAID',
      color: '#d97706',
      bg: 'rgba(217,119,6,0.06)',
      border: 'rgba(217,119,6,0.18)',
      watermark: 'rgba(217,119,6,0.07)',
      wmBorder: 'rgba(217,119,6,0.12)',
    };
  }

  return {
    label: 'UNPAID',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.06)',
    border: 'rgba(220,38,38,0.18)',
    watermark: 'rgba(220,38,38,0.07)',
    wmBorder: 'rgba(220,38,38,0.12)',
  };
}
