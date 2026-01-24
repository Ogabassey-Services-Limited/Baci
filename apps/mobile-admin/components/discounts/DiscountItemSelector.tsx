import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

interface Item {
  id: string;
  name: string;
  description?: string;
  images: string[];
}

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
  const [items, setItems] = useState<Item[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialIds)
  );
  const [loading, setLoading] = useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    try {
      let query;
      if (type === 'product') {
        query = supabase
          .from('products')
          .select('id, name, description, images')
          .eq('merchant_id', merchant?.id)
          .ilike('name', `%${search}%`)
          .limit(50);
      } else {
        query = supabase
          .from('categories')
          .select('id, name, description')
          .eq('merchant_id', merchant?.id)
          .ilike('name', `%${search}%`)
          .limit(50);
      }

      console.log(
        '[DiscountItemSelector] Fetching items for merchant:',
        merchant?.id,
        'Type:',
        type,
        'Search:',
        search
      );
      const { data, error } = await query;
      console.log(
        '[DiscountItemSelector] Data:',
        data?.length,
        'Error:',
        error
      );
      if (error) throw error;
      setItems(
        (data as Item[])?.map((item: Item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          images: item.images || [],
        })) || []
      );
    } catch (error) {
      console.error('[DiscountItemSelector] Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, [merchant, search, type]);

  useEffect(() => {
    console.log(
      '[DiscountItemSelector] useEffect triggered. Visible:',
      visible,
      'MerchantID:',
      merchant?.id
    );
    if (visible && merchant?.id) {
      fetchItems();
    }
  }, [visible, merchant?.id, fetchItems]);

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

  const stripHtml = (html: string) => {
    if (!html) return '';
    // 1. Remove HTML tags (Global, Multiline)
    let textInfo = html.replace(/<[^>]+>/gm, '');
    // 2. Ensure no stray angle brackets remain that could form tags
    textInfo = textInfo.replace(/[<>]/g, '');
    // 3. Decode common entities (excluding < and > to prevent reintroduction)
    // lgtm[js/double-escaping] Safe for React Native Text component
    return textInfo
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>
            Select {type === 'product' ? 'Products' : 'Categories'}
          </Text>
          <Pressable onPress={handleSave} style={styles.saveBtn}>
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
            onSubmitEditing={fetchItems}
          />
        </View>

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
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <Pressable
                  style={[styles.itemRow, { borderBottomColor: colors.border }]}
                  onPress={() => toggleSelection(item.id)}
                >
                  {item.images && item.images.length > 0 && (
                    <Image
                      source={{ uri: item.images[0] }}
                      style={styles.itemImage}
                      contentFit="cover"
                      transition={200}
                    />
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    {item.description && (
                      <Text
                        style={[
                          styles.itemDesc,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {stripHtml(item.description)}
                      </Text>
                    )}
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
    borderBottomColor: '#eee',
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
    backgroundColor: '#f0f0f0',
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
});
