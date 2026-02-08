/**
 * Divider Component
 * Visual divider with "or" text
 *
 * 2026 Best Practices:
 * - Proper accessibility (decorative)
 * - Semantic markup
 */

import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../styles';

interface DividerProps {
  text?: string;
}

export function Divider({ text = 'or' }: DividerProps) {
  return (
    <View
      style={styles.divider}
      accessible={false}
      importantForAccessibility="no"
    >
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{text}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}
