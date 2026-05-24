import Ionicons from "@react-native-vector-icons/ionicons/static";
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  type ThemeShadows,
  TYPOGRAPHY,
} from '@/constants/theme';
import type {
  PaymentMethod,
  PaymentMethodCategory,
  PaymentMethodField,
} from './payment-methods';
import type { PaymentSettings } from '@/schemas/payment-settings';

interface PaymentMethodsSectionProps {
  title: string;
  category: PaymentMethodCategory;
  methods: readonly Readonly<PaymentMethod>[];
  settings?: PaymentSettings;
  colors: ThemeColors;
  shadowStyle: ThemeShadows['sm'];
  isPending: boolean;
  onToggle: (field: PaymentMethodField, value: boolean) => void;
}

export function PaymentMethodsSection({
  title,
  category,
  methods,
  settings,
  colors,
  shadowStyle,
  isPending,
  onToggle,
}: PaymentMethodsSectionProps) {
  const sectionMethods = methods.filter(
    (method) => method.category === category
  );

  return (
    <View
      style={[
        paymentMethodsSectionStyles.card,
        { backgroundColor: colors.card },
        shadowStyle,
      ]}
    >
      <Text
        style={[
          paymentMethodsSectionStyles.sectionTitle,
          { color: colors.text },
        ]}
      >
        {title}
      </Text>
      {sectionMethods.map((method, index) => {
        const isEnabled = settings?.[method.dbField] === true;

        return (
          <View key={method.id}>
            {index > 0 && (
              <View
                style={[
                  paymentMethodsSectionStyles.divider,
                  { backgroundColor: colors.border },
                ]}
              />
            )}
            <View style={paymentMethodsSectionStyles.methodRow}>
              <View
                style={[
                  paymentMethodsSectionStyles.methodIcon,
                  {
                    backgroundColor: isEnabled
                      ? colors.successLight || '#E8F5E9'
                      : colors.cardHover,
                  },
                ]}
              >
                <Ionicons
                  name={method.icon}
                  size={24}
                  color={isEnabled ? colors.success : colors.textMuted}
                />
              </View>
              <View style={paymentMethodsSectionStyles.methodInfo}>
                <Text
                  style={[
                    paymentMethodsSectionStyles.methodName,
                    { color: colors.text },
                  ]}
                >
                  {method.name}
                </Text>
                <Text
                  style={[
                    paymentMethodsSectionStyles.methodDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {method.description}
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={(value) => onToggle(method.dbField, value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isPending}
                accessibilityRole="switch"
                accessibilityLabel={`Toggle ${method.name}`}
                accessibilityHint={`Toggles ${method.name} payment setting`}
                accessibilityState={{ checked: isEnabled, disabled: isPending }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const paymentMethodsSectionStyles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.md,
  },
  divider: { height: 1, marginVertical: SPACING.md },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: { flex: 1 },
  methodName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  methodDescription: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
});
