import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { TrackOrderBottomAction } from './TrackOrderBottomAction';
import { TrackOrderDetailsContent } from './TrackOrderDetailsContent';
import { trackOrderScreenStyles as styles } from './TrackOrderScreen.styles';
import { TrackOrderScreenHeader } from './TrackOrderScreenHeader';
import {
  TrackOrderErrorState,
  TrackOrderLoadingState,
} from './TrackOrderScreenState';
import { useTrackOrderController } from './use-track-order-controller';

export function TrackOrderScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data, error, isLoading } = useTrackOrderController();

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <TrackOrderLoadingState colors={colors} />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <TrackOrderErrorState
          colors={colors}
          errorMessage={error || 'Order not found'}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <TrackOrderScreenHeader colors={colors} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TrackOrderDetailsContent colors={colors} data={data} />
        </ScrollView>
        <TrackOrderBottomAction colors={colors} />
      </SafeAreaView>
    </>
  );
}
