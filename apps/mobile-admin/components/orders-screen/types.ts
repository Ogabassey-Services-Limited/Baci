import type { PaymentStatus, ShippingStatus } from '@baci/shared';
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import type { FlashListProps } from '@shopify/flash-list';
import type { Order } from '@/hooks/useOrders';
import type { useTheme } from '@/hooks/useTheme';

export type OrdersListRow =
  | { type: 'header'; id: string; title: string }
  | { type: 'item'; id: string; order: Order };

export type OrdersCountSnapshot = Partial<Record<ShippingStatus, number>> & {
  all?: number;
  paid?: number;
};

export type OrdersFilterKey = 'all' | 'paid' | ShippingStatus;

export type ThemeColors = ReturnType<typeof useTheme>['colors'];
export type ThemeShadows = ReturnType<typeof useTheme>['shadows'];

export interface StatusDisplayConfig {
  color: string;
  label: string;
}

export interface SourceDisplayConfig extends StatusDisplayConfig {
  icon: IoniconsIconName;
}

export interface StatusAction {
  status: ShippingStatus;
  label: string;
  icon: IoniconsIconName;
  color: string;
}

export interface StatusPressLayout {
  height: number;
  pageX: number;
  pageY: number;
}

export type OrdersListRenderItem = NonNullable<
  FlashListProps<OrdersListRow>['renderItem']
>;

export type OrdersListOnScroll = FlashListProps<OrdersListRow>['onScroll'];

export type PaymentStatusConfigGetter = (
  status: PaymentStatus
) => StatusDisplayConfig;

export type ShippingStatusConfigGetter = (
  status: ShippingStatus
) => StatusDisplayConfig;

export type SourceConfigGetter = (source: string | null) => SourceDisplayConfig;
