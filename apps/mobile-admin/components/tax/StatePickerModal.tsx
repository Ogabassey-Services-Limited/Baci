import { NIGERIAN_STATES } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, Text, View } from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import { getVirtualizedListProps } from '@/components/ui/virtualized-list-props';
import { SPACING } from '@/constants/theme';
import { styles } from './styles';
import type { TaxColors } from './types';

interface StatePickerModalProps {
  visible: boolean;
  colors: TaxColors;
  selectedStateCode: string;
  onClose: () => void;
  onSelect: (stateCode: string) => void;
}

export function StatePickerModal({
  visible,
  colors,
  selectedStateCode,
  onClose,
  onSelect,
}: StatePickerModalProps) {
  return (
    <AppPageSheet
      closeLabel="Close state picker"
      onClose={onClose}
      scrollEnabled={false}
      title="Select State"
      visible={visible}
    >
      <View
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
      >
        <FlatList
          // getItemLayout stride = stateItem height (64) + marginBottom (SPACING.xs=4).
          // Margin is excluded from RN height, so length must include it or scroll offset drifts.
          getItemLayout={(data, index) => ({
            length: 68,
            offset: 68 * index,
            index,
          })}
          data={NIGERIAN_STATES}
          keyExtractor={(item) => item.code}
          contentContainerStyle={{ padding: SPACING.md }}
          {...getVirtualizedListProps()}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.stateItem,
                {
                  backgroundColor:
                    selectedStateCode === item.code
                      ? colors.primaryLight
                      : colors.card,
                  borderColor: colors.border,
                  height: 64,
                },
              ]}
              onPress={() => onSelect(item.code)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              accessibilityState={{
                selected: selectedStateCode === item.code,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.stateItemText,
                  {
                    color:
                      selectedStateCode === item.code
                        ? colors.primary
                        : colors.text,
                  },
                ]}
              >
                {item.name}
              </Text>
              {selectedStateCode === item.code ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </AppPageSheet>
  );
}
