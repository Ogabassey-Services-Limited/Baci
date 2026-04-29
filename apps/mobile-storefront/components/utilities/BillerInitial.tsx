import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { BILLER_INITIAL_TOKENS } from '@/constants/biller-initial';

interface BillerInitialProps {
  colors: { border: string; textSecondary: string };
  name: string;
  style?: StyleProp<ViewStyle>;
}

function getFirstGrapheme(value: string): string {
  const segmenter = (
    Intl as typeof Intl & {
      Segmenter?: new (
        locale?: string,
        options?: { granularity: 'grapheme' }
      ) => { segment: (input: string) => Iterable<{ segment: string }> };
    }
  ).Segmenter;

  if (segmenter) {
    const [firstSegment] = Array.from(
      new segmenter(undefined, { granularity: 'grapheme' }).segment(value)
    );
    return firstSegment?.segment ?? '';
  }

  return Array.from(value)[0] ?? '';
}

export function BillerInitial({ colors, name, style }: BillerInitialProps) {
  const trimmedName = name.trim();
  const safeInitial = (getFirstGrapheme(trimmedName) || '?').toLocaleUpperCase();
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
    borderRadius: BILLER_INITIAL_TOKENS.avatarRadius,
    height: BILLER_INITIAL_TOKENS.avatarSize,
    justifyContent: 'center',
    width: BILLER_INITIAL_TOKENS.avatarSize,
  },
  initialsText: {
    fontSize: BILLER_INITIAL_TOKENS.avatarFontSize,
    fontWeight: '700',
  },
});
