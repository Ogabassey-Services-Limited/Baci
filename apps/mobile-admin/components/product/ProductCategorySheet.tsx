import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductCategorySheetProps {
  categories: CategoryOption[];
  colors: Pick<
    ThemeColors,
    | 'border'
    | 'card'
    | 'error'
    | 'inputBg'
    | 'primary'
    | 'text'
    | 'textOnPrimary'
    | 'textSecondary'
  >;
  isCreating: boolean;
  isSubmittingNewCategory: boolean;
  newCategoryName: string;
  onClose: () => void;
  onCreateCategory: () => void;
  onNewCategoryNameChange: (value: string) => void;
  onSelect: (category: CategoryOption) => void;
  onToggleCreateMode: () => void;
  selectedCategoryId: string;
  visible: boolean;
}

export function ProductCategorySheet({
  categories,
  colors,
  isCreating,
  isSubmittingNewCategory,
  newCategoryName,
  onClose,
  onCreateCategory,
  onNewCategoryNameChange,
  onSelect,
  onToggleCreateMode,
  selectedCategoryId,
  visible,
}: ProductCategorySheetProps) {
  return (
    <AppPageSheet onClose={onClose} title="Select Category" visible={visible}>
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityLabel={
            isCreating ? 'Cancel creating category' : 'Add new category'
          }
          accessibilityRole="button"
          onPress={onToggleCreateMode}
          style={[
            styles.toggleButton,
            {
              backgroundColor: isCreating
                ? `${colors.error}15`
                : `${colors.primary}15`,
            },
          ]}
        >
          <Ionicons
            color={isCreating ? colors.error : colors.primary}
            name={isCreating ? 'close' : 'add'}
            size={18}
          />
          <Text
            style={[
              styles.toggleButtonText,
              { color: isCreating ? colors.error : colors.primary },
            ]}
          >
            {isCreating ? 'Cancel' : 'Add New'}
          </Text>
        </Pressable>
      </View>

      {isCreating ? (
        <View style={styles.createRow}>
          <TextInput
            accessibilityLabel="New category name"
            onChangeText={onNewCategoryNameChange}
            placeholder="New Category Name"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={newCategoryName}
          />
          <Pressable
            accessibilityLabel="Create category"
            accessibilityRole="button"
            disabled={isSubmittingNewCategory || newCategoryName.trim() === ''}
            onPress={onCreateCategory}
            style={[styles.createButton, { backgroundColor: colors.primary }]}
          >
            {isSubmittingNewCategory ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text
                style={[
                  styles.createButtonText,
                  { color: colors.textOnPrimary },
                ]}
              >
                Add
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.categoryList}>
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id;

          return (
            <Pressable
              key={category.id}
              accessibilityLabel={`Select ${category.name}`}
              accessibilityRole="button"
              onPress={() => onSelect(category)}
              style={[
                styles.categoryItem,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.categoryText, { color: colors.text }]}>
                {category.name}
              </Text>
              {isSelected ? (
                <Ionicons color={colors.primary} name="checkmark" size={20} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </AppPageSheet>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: SPACING.md,
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toggleButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  createRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  createButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: SPACING.md,
  },
  createButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  categoryList: {
    gap: SPACING.xs,
  },
  categoryItem: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.size.lg,
  },
});
