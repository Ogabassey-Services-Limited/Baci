import { NIGERIAN_STATES } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
      >
        <View
          style={[styles.modalHeader, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Select State
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <FlatList
          data={NIGERIAN_STATES}
          keyExtractor={(item) => item.code}
          contentContainerStyle={{ padding: SPACING.md }}
          // ⚡ Bolt Performance Optimization
          // Applying standard windowing props to optimize Modal render cycles and prevent UI thread blocking
          // initialNumToRender: Keeps initial mount fast by limiting items rendered on first pass
          // maxToRenderPerBatch: Prevents dropping frames when rendering subsequent items
          // windowSize: Reduces memory footprint by keeping only a small buffer of items outside the viewport
          // removeClippedSubviews: Frees memory for off-screen views (Android only due to iOS clipping bugs)
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
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
                },
              ]}
              onPress={() => onSelect(item.code)}
            >
              <Text
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
    </Modal>
  );
}
