/**
 * Baci Logo Component
 * Uses the actual Baci app icon (navy bag with white cloud)
 */

import { StyleSheet, View } from 'react-native';
import SafeImage from '@/components/ui/SafeImage';

const BaciIcon = require('@/assets/images/icon.png');

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
        source={BaciIcon}
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
