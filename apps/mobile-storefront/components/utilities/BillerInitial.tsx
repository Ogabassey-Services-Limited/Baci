import { StyleSheet, Text, View } from 'react-native';

interface BillerInitialProps {
  colors: { border: string; textSecondary: string };
  name: string;
}

export function BillerInitial({ colors, name }: BillerInitialProps) {
  const trimmedName = name.trim();
  const safeInitial = (trimmedName.charAt(0) || '?').toUpperCase();
  const accessibilityLabel = trimmedName
    ? `Biller: ${trimmedName}`
    : 'Unknown biller';

  return (
    <View
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      style={[styles.initialsCircle, { backgroundColor: colors.border }]}
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
    marginBottom: 8,
    width: 48,
  },
  initialsText: {
    fontSize: 20,
    fontWeight: '700',
  },
});
