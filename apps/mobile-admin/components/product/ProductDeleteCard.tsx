import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';

interface ProductDeleteCardProps {
  colors: Pick<
    ThemeColors,
    'border' | 'card' | 'error' | 'errorLight' | 'text' | 'textSecondary'
  >;
  disabled: boolean;
  onConfirmDelete: () => Promise<void> | void;
  productName: string;
}

function getDeleteErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Failed to delete product. Please try again.';
}

export function ProductDeleteCard({
  colors,
  disabled,
  onConfirmDelete,
  productName,
}: ProductDeleteCardProps) {
  const displayName = productName.trim() || 'this product';

  const handlePress = () => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${displayName}"?\n\nThis will hide the product from your catalog and storefront. Existing order history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void Promise.resolve(onConfirmDelete()).catch((error: unknown) => {
              Alert.alert('Delete Failed', getDeleteErrorMessage(error));
            });
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>
          Delete Product
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Hide this product from the catalog and storefront. Existing orders
          stay intact.
        </Text>
      </View>
      <Pressable
        accessibilityLabel={disabled ? 'Deleting product' : 'Delete product'}
        accessibilityRole="button"
        accessibilityState={{ busy: disabled, disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={[
          styles.button,
          {
            backgroundColor: colors.errorLight,
            borderColor: colors.error,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.error }]}>
          {disabled ? 'Deleting...' : 'Delete'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  copy: {
    gap: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
