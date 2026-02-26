import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import SafeImage from '@/components/ui/SafeImage';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeSearchQuery } from '@/lib/sanitize';
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

  useEffect(() => {
    if (__DEV__) {
      console.log(
        '[DiscountItemSelector] useEffect triggered. Visible:',
        visible,
        'MerchantID:',
        merchant?.id
      );
    }
    if (!visible || !merchant?.id) return;

    const fetchItems = async () => {
      setLoading(true);
      try {
        const sanitizedSearch = sanitizeSearchQuery(search);
        const { data, error } =
          type === 'product'
            ? await supabase
                .from('products')
                .select('id, name, description, images')
                .eq('merchant_id', merchant.id)
                .ilike('name', `%${sanitizedSearch}%`)
                .limit(50)
            : await supabase
                .from('categories')
                .select('id, name, description')
                .eq('merchant_id', merchant.id)
                .ilike('name', `%${sanitizedSearch}%`)
                .limit(50);

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
    };

    fetchItems();
  }, [visible, merchant?.id, search, type]);

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
    return (
      html
        // 1. Replace known tags with space to preserve word separation
        .replace(/<[^>]+>/g, ' ')
        // 2. Nuclear option: Remove ALL remaining angle brackets to ensure
        // no HTML tags can exist. This satisfies CodeQL that <script> is impossible.
        .replace(/[<>]/g, '')
        // 3. Decode harmless entities (excluding < and >)
        // IMPORTANT: Decode &amp; LAST to prevent double-unescaping patterns
        // like &amp;quot; → &quot; → " (which would be a security issue)
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
    );
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
            returnKeyType="search"
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
});
