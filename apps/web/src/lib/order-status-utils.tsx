import { CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';
import type React from 'react';

/**
 * Returns neutral Tailwind CSS classes for the order status badge.
 * Uses gray-based tones that work with any merchant theme.
 */
export function getStatusColor(status: string): string {
  const s = status?.toLowerCase();
  if (s === 'processing' || s === 'pending')
    return 'bg-gray-100 text-gray-700 border-gray-200';
  if (s === 'delivered') return 'bg-gray-100 text-gray-700 border-gray-200';
  if (s === 'cancelled') return 'bg-gray-100 text-gray-700 border-gray-200';
  if (s === 'shipped') return 'bg-gray-100 text-gray-700 border-gray-200';
  return 'bg-gray-50 text-gray-600 border-gray-100';
}

/**
 * Returns the appropriate icon component for an order status.
 */
export function getStatusIcon(status: string): React.ReactElement {
  const s = status?.toLowerCase();
  if (s === 'processing' || s === 'pending') return <Clock size={16} />;
  if (s === 'delivered') return <CheckCircle2 size={16} />;
  if (s === 'cancelled') return <XCircle size={16} />;
  if (s === 'shipped') return <Truck size={16} />;
  return <Package size={16} />;
}
