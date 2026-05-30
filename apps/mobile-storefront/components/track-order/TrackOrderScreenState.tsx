import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { trackOrderScreenStyles as styles } from './TrackOrderScreen.styles';

type ColorsScheme = (typeof Colors)['light'];

interface TrackOrderStateProps {
  colors: ColorsScheme;
}

export function TrackOrderLoadingState({ colors }: TrackOrderStateProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading order details...
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface TrackOrderErrorStateProps extends TrackOrderStateProps {
  errorMessage: string;
}

export function TrackOrderErrorState({
  colors,
  errorMessage,
}: TrackOrderErrorStateProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {errorMessage}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: BRAND.primary },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Return to home page"
        >
          <Text style={styles.retryBtnText}>Go Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
