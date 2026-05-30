import Ionicons from "@react-native-vector-icons/ionicons";
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { orderDetailsScreenStyles as styles } from './OrderDetailsScreen.styles';

type ColorsScheme = (typeof Colors)['light'];

interface OrderDetailsStateProps {
  backgroundColor: string;
  colors: ColorsScheme;
}

export function OrderDetailsLoadingState({
  backgroundColor,
}: OrderDetailsStateProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor }]}
      edges={['top', 'left', 'right']}
    >
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    </SafeAreaView>
  );
}

interface OrderDetailsErrorStateProps extends OrderDetailsStateProps {
  errorMessage: string;
  onGoBack: () => void;
}

export function OrderDetailsErrorState({
  backgroundColor,
  colors,
  errorMessage,
  onGoBack,
}: OrderDetailsErrorStateProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor }]}
      edges={['top', 'left', 'right']}
    >
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor },
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {errorMessage}
        </Text>
        <TouchableOpacity
          onPress={onGoBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.retryText, { color: BRAND.primary }]}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
