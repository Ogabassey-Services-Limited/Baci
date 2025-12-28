/**
 * Baci Logo Component
 * Yellow background with navy blue shopping bag icon
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BaciLogoProps {
  size?: number;
  borderRadius?: number;
}

export function BaciLogo({ size = 32, borderRadius = 8 }: BaciLogoProps) {
  const iconSize = size * 0.6;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#f0bf58',
        },
      ]}
    >
      <Ionicons name="bag-handle" size={iconSize} color="#23255d" />
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
