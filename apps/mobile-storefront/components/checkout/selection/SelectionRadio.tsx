import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { BRAND } from '@/constants/Colors';
import type { SelectionColors } from './colors';

interface SelectionRadioProps {
  selected: boolean;
  colors: SelectionColors;
  size?: 20 | 22;
}

/**
 * The one "selected" vocabulary across checkout: a ring that fills red with a
 * scale-in dot. Shared by payment and delivery so selection reads identically
 * everywhere. The dot's ZoomIn respects the OS reduce-motion setting by default.
 */
export function SelectionRadio({
  selected,
  colors,
  size = 22,
}: SelectionRadioProps): ReactElement {
  const dot = size - 10;

  return (
    <View
      testID="selection-radio"
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: selected ? BRAND.primary : colors.border,
        },
      ]}
    >
      {selected ? (
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          testID="selection-radio-dot"
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: BRAND.primary,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});
