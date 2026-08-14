import { StyleSheet, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { GadgetPattern } from './GadgetPattern';

const PATTERN_HEIGHT = 1500;
const DARK_PATTERN_COLOR = '#ffffff';
const DARK_PATTERN_OPACITY = 0.04;
const LIGHT_PATTERN_OPACITY = 0.07;

interface PatternedBackgroundProps {
  backgroundColor: string;
  isDark: boolean;
}

export function PatternedBackground({
  backgroundColor,
  isDark,
}: PatternedBackgroundProps) {
  return (
    <>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor }]}
        testID="patterned-background-base"
      />
      <View style={[StyleSheet.absoluteFill, styles.patternClip]}>
        <GadgetPattern
          colorScheme={isDark ? 'dark' : 'light'}
          opacity={isDark ? DARK_PATTERN_OPACITY : LIGHT_PATTERN_OPACITY}
          height={PATTERN_HEIGHT}
          color={isDark ? DARK_PATTERN_COLOR : BRAND.primary}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  patternClip: {
    overflow: 'hidden',
  },
});
