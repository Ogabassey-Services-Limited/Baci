import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import SafeImage from '@/components/ui/SafeImage';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import {
  fetchSelectableItems,
  type SelectableItem,
} from '@/lib/discount-items';
import { stripHtmlTags } from '@/lib/sanitize';
import { styles } from './discount-item-selector.styles';

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
  const title = `Select ${type === 'product' ? 'Products' : 'Categories'}`;

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
    <AppPageSheet
      closeLabel="Close discount item selector"
      contentContainerStyle={styles.pageSheetContent}
      onClose={onClose}
      scrollEnabled={false}
      title={title}
      trailingAccessory={
        <Pressable
          accessibilityLabel="Done"
          accessibilityRole="button"
          onPress={handleSave}
          style={styles.doneButton}
        >
          <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
        </Pressable>
      }
      visible={visible}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: colors.backgroundLight,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              color={colors.textMuted}
              name="search"
              size={20}
              style={styles.searchIcon}
            />
            <TextInput
              accessibilityLabel="Search discount items"
              onChangeText={setSearch}
              onSubmitEditing={() => {
                void handleFetchItems(search);
              }}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
            />
            {search.length > 0 ? (
              <Pressable
                accessibilityHint="Clears the discount item search input"
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => {
                  setSearch('');
                  void handleFetchItems('');
                }}
              >
                <Ionicons
                  color={colors.textMuted}
                  name="close-circle"
                  size={18}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {_fetchError && !loading ? (
          <View
            style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}
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
            contentContainerStyle={styles.list}
            data={items}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <Pressable
                  accessibilityLabel={`${item.name}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => toggleSelection(item.id)}
                  style={[styles.itemRow, { borderBottomColor: colors.border }]}
                >
                  {item.images && item.images.length > 0 ? (
                    <SafeImage
                      contentFit="cover"
                      source={{ uri: item.images[0] }}
                      style={[
                        styles.itemImage,
                        { backgroundColor: colors.inputBg },
                      ]}
                      transition={200}
                    />
                  ) : null}
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.itemDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {stripHtmlTags(item.description)}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Ionicons
                      color={colors.primary}
                      name="checkmark-circle"
                      size={24}
                    />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </AppPageSheet>
  );
}
