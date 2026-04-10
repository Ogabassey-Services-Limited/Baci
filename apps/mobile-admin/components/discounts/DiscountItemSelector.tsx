import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import {
  fetchSelectableItems,
  type SelectableItem,
} from '@/lib/discount-items';
import { stripHtmlTags } from '@/lib/sanitize';

interface DiscountItemSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (ids: string[]) => void;
  initialIds: string[];
  type: 'product' | 'category';
}

export function DiscountItemSelector({
  visible,
  onClose,
  onSelect,
  initialIds,
  type,
}: DiscountItemSelectorProps) {
  const { colors } = useTheme();
  const { merchant } = useMerchant();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<SelectableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialIds)
  );
  const [loading, setLoading] = useState(false);
  const [_fetchError, setFetchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const handleFetchItems = async (searchTerm: string) => {
    if (!merchant?.id) {
      setItems([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setFetchError(null);
    try {
      const fetchedItems = await fetchSelectableItems({
        merchantId: merchant.id,
        type,
        search: searchTerm,
      });
      if (requestId !== requestIdRef.current) return;
      setItems(fetchedItems);
    } catch (error) {
      console.error('[DiscountItemSelector] Error fetching items:', error);
      if (requestId === requestIdRef.current) {
        setFetchError('Failed to load items');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set(initialIds));
      setSearch('');
    }
  }, [visible, initialIds]);

  useEffect(() => {
    const loadInitialItems = async () => {
      if (!visible || !merchant?.id) return;

      const requestId = ++requestIdRef.current;
      setLoading(true);
      setFetchError(null);
      try {
        const fetchedItems = await fetchSelectableItems({
          merchantId: merchant.id,
          type,
          search: '',
        });
        if (requestId !== requestIdRef.current) return;
        setItems(fetchedItems);
      } catch (error) {
        console.error('[DiscountItemSelector] Error fetching items:', error);
        if (requestId === requestIdRef.current) {
          setFetchError('Failed to load items');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    void loadInitialItems();

    return () => {
      requestIdRef.current += 1;
    };
  }, [visible, merchant?.id, type]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSave = () => {
    onSelect(Array.from(selectedIds));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={24}
        style={styles.container}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>
              Select {type === 'product' ? 'Products' : 'Categories'}
            </Text>
            <Pressable
              onPress={handleSave}
              style={styles.saveBtn}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={[styles.saveText, { color: colors.primary }]}>
                Done
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.backgroundLight },
            ]}
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                // Debounce could be added here
              }}
              onSubmitEditing={() => {
                void handleFetchItems(search);
              }}
            />
          </View>

          {_fetchError && !loading ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colors.errorLight },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>
                {_fetchError}
              </Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'on-drag'
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <Pressable
                    style={[
                      styles.itemRow,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => toggleSelection(item.id)}
                    accessible={true}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${item.name}`}
                    accessibilityState={{ checked: isSelected }}
                  >
                    {item.images && item.images.length > 0 && (
                      <SafeImage
                        source={{ uri: item.images[0] }}
                        style={[
                          styles.itemImage,
                          { backgroundColor: colors.inputBg },
                        ]}
                        contentFit="cover"
                        transition={200}
                      />
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      {item.description ? (
                        <Text
                          style={[
                            styles.itemDesc,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {stripHtmlTags(item.description)}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: SPACING.xs },
  saveBtn: { padding: SPACING.xs },
  title: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  loader: { marginTop: SPACING.xl },
  list: { paddingHorizontal: SPACING.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.md,
  },
  itemInfo: { flex: 1, marginRight: SPACING.md },
  itemName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  itemDesc: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
