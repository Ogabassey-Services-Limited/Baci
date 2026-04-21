import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import { OrderDetailsScreenContent } from '@/components/orders/OrderDetailsScreenContent';
import { useOrderDetailsController } from '@/hooks/useOrderDetailsController';

export default function OrderDetailsScreen() {
  const controller = useOrderDetailsController();

  if (controller.isInvalidRoute) {
    return (
      <InvalidRouteScreen
        title="Invalid Order"
        message="The order ID is invalid. Please check the link and try again."
      />
    );
  }

  if (controller.isLoading) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: controller.colors.background,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={controller.colors.primary} />
      </View>
    );
  }

  if (controller.error || !controller.order) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: controller.colors.background,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={controller.colors.error}
        />
        <Text
          style={{
            color: controller.colors.text,
            fontSize: 16,
            fontWeight: '600',
            marginTop: 12,
          }}
        >
          Failed to load order
        </Text>
        <Pressable
          accessibilityHint="Returns to the previous screen"
          accessibilityLabel="Go back"
          accessibilityRole="button"
          accessible
          onPress={() => router.back()}
          style={{ marginTop: 12, padding: 12 }}
        >
          <Text style={{ color: controller.colors.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return <OrderDetailsScreenContent controller={controller} />;
}
