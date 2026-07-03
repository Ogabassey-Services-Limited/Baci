import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type { NewOrderController } from '@/hooks/useNewOrderController';
import { styles } from './new-order.styles';

type NewOrderCreateProductRowColors = Pick<
  NewOrderController['colors'],
  'border' | 'card' | 'primary' | 'textSecondary'
>;

interface NewOrderCreateProductRowProps {
  colors: NewOrderCreateProductRowColors;
  onPress: () => void;
}

export function NewOrderCreateProductRow({
  colors,
  onPress,
}: NewOrderCreateProductRowProps) {
  return (
    <Pressable
      accessibilityLabel="Create new product"
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.listRow,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        },
      ]}
    >
      <View
        style={[styles.iconBox, { backgroundColor: `${colors.primary}20` }]}
      >
        <Ionicons color={colors.primary} name="add" size={20} />
      </View>
      <View>
        <Text
          style={{
            color: colors.primary,
            fontSize: 16,
            fontWeight: '600',
          }}
        >
          Create New Product
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Add a new item to inventory
        </Text>
      </View>
    </Pressable>
  );
}
