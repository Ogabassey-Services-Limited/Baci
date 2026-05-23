import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';

export interface TrackingEvent {
  status: string;
  description: string;
  location?: string;
  timestamp: string;
}

export interface TrackingResult {
  trackingNumber: string;
  carrier: string;
  provider: string;
  status: string;
  statusLabel: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: TrackingEvent[];
  shipment?: {
    id: string;
    orderId: string;
    receiverCity?: string;
    receiverState?: string;
    estimatedDays?: number;
  };
}

export const TRACKING_STATUS_CONFIG: Record<
  string,
  {
    icon: typeof Package;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  pending: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    label: 'Order Received',
  },
  booked: {
    icon: Package,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    label: 'Shipment Booked',
  },
  pickup_scheduled: {
    icon: Package,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    label: 'Pickup Scheduled',
  },
  picked_up: {
    icon: Truck,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-100',
    label: 'Picked Up',
  },
  in_transit: {
    icon: Truck,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100',
    label: 'In Transit',
  },
  out_for_delivery: {
    icon: Truck,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100',
    label: 'Out for Delivery',
  },
  delivered: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    label: 'Delivered',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100',
    label: 'Cancelled',
  },
  failed: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100',
    label: 'Delivery Failed',
  },
  returned: {
    icon: Package,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100',
    label: 'Returned',
  },
};
