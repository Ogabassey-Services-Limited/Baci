import { Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { UtilityHeader } from './UtilityHeader';
import { utilityPurchaseStyles as styles } from './utility-purchase.styles';

interface InvalidUtilityServiceViewProps {
  colors: typeof Colors.light;
  onBack: () => void;
  topInset: number;
}

export function InvalidUtilityServiceView({
  colors,
  onBack,
  topInset,
}: InvalidUtilityServiceViewProps) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <UtilityHeader
        title="Invalid Service"
        onBack={onBack}
        titleColor={colors.text}
        dividerColor={colors.border}
        iconBackgroundColor={colors.card}
        iconColor={colors.text}
        topInset={topInset}
        surfaceColor={colors.background}
      />
      <View style={styles.errorContainer}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Service Not Found
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          The requested utility service is not available.
        </Text>
        <Pressable
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={onBack}
          accessibilityLabel="Go back to previous screen"
          accessibilityRole="button"
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
