import type {
  Order,
  OrderItem,
  PaymentStatus,
  ShippingStatus,
} from '@baci/shared';

export type { Order, OrderItem, PaymentStatus, ShippingStatus };

export interface OrderWithCount extends Order {
  item_count?: number;
  items?: OrderItem[];
}

export interface OrdersPage {
  orders: Order[];
  nextCursor: number | null;
  totalCount: number;
}
