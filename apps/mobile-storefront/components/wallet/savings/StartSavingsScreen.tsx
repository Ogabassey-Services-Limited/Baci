import { RefreshControl, ScrollView, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { StartSavingsForm } from './StartSavingsForm';
import { StartSavingsModals } from './StartSavingsModals';
import { startSavingsStyles as styles } from './start-savings.styles';
import { useStartSavingsController } from './use-start-savings-controller';

export function StartSavingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const controller = useStartSavingsController();

  return (
    // The route component owns StorefrontScreenShell; this inner view owns
    // pull-to-refresh because the shared shell has no scroll/refresh API.
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={controller.isRefetching}
            onRefresh={controller.refetch}
            tintColor={BRAND.primary}
          />
        }
      >
        <StartSavingsForm colors={colors} controller={controller} />
      </ScrollView>

      <StartSavingsModals colors={colors} controller={controller} />
    </View>
  );
}
