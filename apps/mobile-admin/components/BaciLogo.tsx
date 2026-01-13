/**
 * Baci Logo Component
 * Uses the actual Baci app icon (navy bag with white cloud)
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

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
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('@/assets/images/icon.png')}
        style={{ width: size, height: size }}
        resizeMode="cover"
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
