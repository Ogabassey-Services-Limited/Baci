import type { Order } from '@baci/shared';
import { format } from 'date-fns';

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let text = String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildOrdersCsv(orders: Order[]): string {
  const headers = [
    'Order Number',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Date',
    'Status',
    'Payment Status',
    'Total',
    'Items',
    'Address',
    'City',
    'State',
  ];

  const rows = orders.map((order) =>
    [
      order.order_number,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
      order.shipping_status,
      order.payment_status,
      order.total,
      order.item_count || 0,
      order.shipping_address?.address_line1,
      order.shipping_address?.city,
      order.shipping_address?.state,
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
