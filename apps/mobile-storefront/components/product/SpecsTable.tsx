/**
 * SpecsTable - Renders product specifications in a bordered table layout.
 */

import { StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { RADIUS } from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

interface SpecsTableProps {
  specifications: Record<string, unknown>;
  colors: ColorsScheme;
}

export function SpecsTable({ specifications, colors }: SpecsTableProps) {
  const entries = Object.entries(specifications);
  if (entries.length === 0) return null;

  return (
    <View style={[styles.specsTable, { borderColor: colors.border }]}>
      {entries.map(([key, val], i) => (
        <View
          key={key}
          style={[
            styles.specRow,
            i !== 0 && {
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.specKey, { color: colors.textSecondary }]}>
            {key}
          </Text>
          <Text style={[styles.specValue, { color: colors.text }]}>
            {typeof val === 'object' && val !== null
              ? JSON.stringify(val)
              : String(val ?? '')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  specsTable: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  specKey: {
    fontSize: 14,
    fontWeight: '500',
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
