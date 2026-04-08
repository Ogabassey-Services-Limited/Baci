'use client';

import { CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';

export function getOrderStatusColor(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'processing' || normalizedStatus === 'pending') {
    return 'bg-blue-50 text-blue-600 border-blue-100';
  }
  if (normalizedStatus === 'delivered') {
    return 'bg-green-50 text-green-600 border-green-100';
  }
  if (normalizedStatus === 'cancelled') {
    return 'bg-red-50 text-red-600 border-red-100';
  }
  if (normalizedStatus === 'shipped') {
    return 'bg-amber-50 text-amber-600 border-amber-100';
  }

  return 'bg-gray-50 text-gray-600 border-gray-100';
}

export function getOrderStatusIcon(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'processing' || normalizedStatus === 'pending') {
    return <Clock size={16} />;
  }
  if (normalizedStatus === 'delivered') {
    return <CheckCircle2 size={16} />;
  }
  if (normalizedStatus === 'cancelled') {
    return <XCircle size={16} />;
  }
  if (normalizedStatus === 'shipped') {
    return <Truck size={16} />;
  }

  return <Package size={16} />;
}
