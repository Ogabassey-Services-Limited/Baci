import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

interface BillerInitialProps {
  colors: { border: string; textSecondary: string };
  name: string;
  style?: StyleProp<ViewStyle>;
}

export function BillerInitial({ colors, name, style }: BillerInitialProps) {
  const trimmedName = name.trim();
  const safeInitial = (trimmedName.charAt(0) || '?').toUpperCase();
  const accessibilityLabel = trimmedName
    ? `Biller: ${trimmedName}`
    : 'Unknown biller';

  return (
    <View
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      style={[styles.initialsCircle, { backgroundColor: colors.border }, style]}
    >
      <Text style={[styles.initialsText, { color: colors.textSecondary }]}>
        {safeInitial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initialsCircle: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  initialsText: {
    fontSize: 20,
    fontWeight: '700',
  },
});
