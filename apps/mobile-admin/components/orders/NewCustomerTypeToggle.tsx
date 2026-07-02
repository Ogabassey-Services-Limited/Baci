import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { customerCreateStyles as customerStyles } from './NewOrderCustomerCreateView.styles';
import type { NewCustomerDraft } from './new-order.types';

type CustomerType = NewCustomerDraft['customerType'];

interface NewCustomerTypeToggleProps {
  colors: ThemeColors;
  onChange: (value: CustomerType) => void;
  value: CustomerType;
}

const OPTIONS: Array<{
  icon: 'person-outline' | 'business-outline';
  label: string;
  value: CustomerType;
}> = [
  { icon: 'person-outline', label: 'Person', value: 'individual' },
  { icon: 'business-outline', label: 'Company', value: 'company' },
];

export function NewCustomerTypeToggle({
  colors,
  onChange,
  value,
}: NewCustomerTypeToggleProps) {
  return (
    <View
      style={[
        customerStyles.typeToggle,
        { backgroundColor: colors.inputBg, borderColor: colors.border },
      ]}
    >
      {OPTIONS.map((option) => {
        const isSelected = value === option.value;

        return (
          <Pressable
            accessibilityLabel={`Set customer type to ${option.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              customerStyles.typeToggleOption,
              isSelected ? { backgroundColor: colors.primary } : null,
            ]}
          >
            <Ionicons
              color={isSelected ? colors.textOnPrimary : colors.textMuted}
              name={option.icon}
              size={17}
            />
            <Text
              style={[
                customerStyles.typeToggleLabel,
                { color: isSelected ? colors.textOnPrimary : colors.textMuted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
