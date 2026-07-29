import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { ThemeColors } from '@/constants/theme';
import { getTranslucentColor } from '@/lib/colors/sanitize-css-color';
import { productCategorySheetStyles as styles } from './product-category-sheet.styles';

const CATEGORY_SHEET_SNAP_POINTS = ['72%'];

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
  const sheetRef = useRef<BottomSheet>(null);
  const requestClose = () => sheetRef.current?.close();
  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.52}
      pressBehavior="close"
    />
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal animationType="none" onRequestClose={requestClose} transparent>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <BottomSheet
          ref={sheetRef}
          android_keyboardInputMode="adjustResize"
          backdropComponent={renderBackdrop}
          backgroundStyle={[
            styles.sheetBackground,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          enableDynamicSizing={false}
          enablePanDownToClose={true}
          handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
          index={0}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          onClose={onClose}
          snapPoints={CATEGORY_SHEET_SNAP_POINTS}
        >
          <View
            accessibilityLabel="Product category drawer"
            accessibilityViewIsModal
            style={styles.drawerContent}
          >
            <View
              style={[styles.sheetHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Select Category
              </Text>
              <Pressable
                accessibilityLabel="Close category sheet"
                accessibilityRole="button"
                hitSlop={12}
                onPress={requestClose}
                style={styles.closeButton}
              >
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>

            <BottomSheetScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
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
                        ? getTranslucentColor(
                            colors.error,
                            'rgba(239,68,68,0.08)',
                            0.08
                          )
                        : getTranslucentColor(
                            colors.primary,
                            'rgba(59,130,246,0.08)',
                            0.08
                          ),
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
                  <BottomSheetTextInput
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
                    disabled={
                      isSubmittingNewCategory || newCategoryName.trim() === ''
                    }
                    onPress={onCreateCategory}
                    style={[
                      styles.createButton,
                      { backgroundColor: colors.primary },
                    ]}
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
                      <Text
                        style={[styles.categoryText, { color: colors.text }]}
                      >
                        {category.name}
                      </Text>
                      {isSelected ? (
                        <Ionicons
                          color={colors.primary}
                          name="checkmark"
                          size={20}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </BottomSheetScrollView>
          </View>
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}
