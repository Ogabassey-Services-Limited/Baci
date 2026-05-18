/**
 * Baci Logo Component
 * Uses the actual Baci app icon (navy bag with white cloud)
 */

import { StyleSheet, View } from 'react-native';
import baciIcon from '@/assets/images/icon.png';
import SafeImage from '@/components/ui/SafeImage';

interface BaciLogoProps {
  size?: number;
  borderRadius?: number;
}

export function BaciLogo({ size = 32, borderRadius = 8 }: BaciLogoProps) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
        },
      ]}
    >
      <SafeImage
        source={baciIcon}
        style={{ width: size, height: size }}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
