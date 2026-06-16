import { Pressable, Text, View } from 'react-native';
import {
  DEFAULT_TRANSLUCENT_PRIMARY,
  type ThemeColors,
} from '@/constants/theme';
import type { Branch } from '@/schemas/branch';
import { getTranslucentColor } from '@/lib/colors/sanitize-css-color';
import { productRestockSheetStyles as styles } from './ProductRestockSheet.styles';
import {
  type RestockIdentifierMode,
  type RestockSource,
  restockSourceLabels,
  restockSources,
} from './ProductRestockSheet.utils';

interface ProductRestockOptionsProps {
  branches: Branch[];
  colors: ThemeColors;
  mode: RestockIdentifierMode;
  onBranchChange: (branchId: string | null) => void;
  onModeChange: (mode: RestockIdentifierMode) => void;
  onSourceChange: (source: RestockSource) => void;
  selectedBranchId: string | null;
  source: RestockSource;
}

function selectedStyle(colors: ThemeColors) {
  return {
    backgroundColor: getTranslucentColor(
      colors.primary,
      DEFAULT_TRANSLUCENT_PRIMARY,
      0.08
    ),
    borderColor: colors.primary,
  };
}

function optionTextColor(
  colors: ThemeColors,
  isSelected: boolean
): { color: string; fontSize: number; fontWeight: '600' } {
  return {
    color: isSelected ? colors.primary : colors.text,
    fontSize: 13,
    fontWeight: '600',
  };
}

export function ProductRestockOptions({
  branches,
  colors,
  mode,
  onBranchChange,
  onModeChange,
  onSourceChange,
  selectedBranchId,
  source,
}: ProductRestockOptionsProps) {
  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Identifier Type
        </Text>
        <View style={styles.modeRow}>
          {(['imei', 'serial'] as const).map((nextMode) => {
            const isSelected = mode === nextMode;
            const label = nextMode === 'imei' ? 'IMEI' : 'Serial Number';
            return (
              <Pressable
                accessibilityLabel={`Select ${label} mode`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                key={nextMode}
                onPress={() => onModeChange(nextMode)}
                style={[
                  styles.modeTab,
                  { borderColor: colors.border },
                  isSelected && selectedStyle(colors),
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    { color: isSelected ? colors.primary : colors.text },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {branches.length > 1 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Assign to Branch
          </Text>
          <View style={styles.radioGroup}>
            <Pressable
              accessibilityLabel="Assign to all/no specific branch"
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedBranchId === null }}
              onPress={() => onBranchChange(null)}
              style={[
                styles.radioItem,
                { borderColor: colors.border },
                selectedBranchId === null && selectedStyle(colors),
              ]}
            >
              <Text style={optionTextColor(colors, selectedBranchId === null)}>
                Central Stock (None)
              </Text>
            </Pressable>
            {branches.map((branch) => {
              const isSelected = branch.id === selectedBranchId;
              return (
                <Pressable
                  accessibilityLabel={`Assign to ${branch.name}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  key={branch.id}
                  onPress={() => onBranchChange(branch.id)}
                  style={[
                    styles.radioItem,
                    { borderColor: colors.border },
                    isSelected && selectedStyle(colors),
                  ]}
                >
                  <Text style={optionTextColor(colors, isSelected)}>
                    {branch.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Stock Source
        </Text>
        <View style={styles.radioGroup}>
          {restockSources.map((nextSource) => {
            const isSelected = source === nextSource;
            const label = restockSourceLabels[nextSource];
            return (
              <Pressable
                accessibilityLabel={`Select source ${label}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                key={nextSource}
                onPress={() => onSourceChange(nextSource)}
                style={[
                  styles.radioItem,
                  { borderColor: colors.border },
                  isSelected && selectedStyle(colors),
                ]}
              >
                <Text style={optionTextColor(colors, isSelected)}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}
