import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

interface OrderDetailsHeaderActionsProps {
  canEditOrder: boolean;
  colors: {
    primary: string;
  };
  onShare: () => void;
  orderId: string;
}

export function OrderDetailsHeaderActions({
  canEditOrder,
  colors,
  onShare,
  orderId,
}: OrderDetailsHeaderActionsProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      {canEditOrder ? (
        <Pressable
          accessibilityLabel="Edit order"
          accessibilityRole="button"
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={() => {
            router.push(`/order/edit?id=${encodeURIComponent(orderId)}`);
          }}
          style={{ padding: 4 }}
        >
          <Ionicons color={colors.primary} name="create-outline" size={24} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel="Share order"
        accessibilityRole="button"
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        onPress={() => {
          void onShare();
        }}
        style={{ padding: 4 }}
      >
        <Ionicons color={colors.primary} name="share-outline" size={24} />
      </Pressable>
    </View>
  );
}
