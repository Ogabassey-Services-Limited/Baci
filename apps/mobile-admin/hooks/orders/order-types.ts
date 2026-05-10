import type { Order, OrderItem } from '@baci/shared';

export interface OrderWithCount extends Order {
  item_count?: number;
  items?: OrderItem[];
}

export interface OrdersPage {
  nextCursor: number | null;
  orders: Order[];
  totalCount: number;
}
