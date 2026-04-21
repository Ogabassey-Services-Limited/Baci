import { BRAND_COLORS } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { orderDetailsOverviewStyles as styles } from './order-details-overview.styles';

interface OrderDetailsCustomerCardProps {
  colors: ThemeColors;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;
  isGeneratingReceipt: boolean;
  onCall: () => void;
  onEmail: () => void;
  onSendOrderDetailsToRider: () => void;
  onSendReceipt: () => void;
  onSendRiderToCustomer: () => void;
  onWhatsApp: () => void;
  showPostShipmentActions: boolean;
}

export function OrderDetailsCustomerCard({
  colors,
  customerEmail,
  customerName,
  customerPhone,
  isGeneratingReceipt,
  onCall,
  onEmail,
  onSendOrderDetailsToRider,
  onSendReceipt,
  onSendRiderToCustomer,
  onWhatsApp,
  showPostShipmentActions,
}: OrderDetailsCustomerCardProps) {
  const hasCustomerPhone = Boolean(customerPhone?.trim());

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>Customer</Text>

      <View style={styles.customerRow}>
        <View
          style={[
            styles.avatarPlaceholder,
            { backgroundColor: `${colors.primary}15` },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {customerName?.[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: colors.text }]}>
            {customerName}
          </Text>
          <Text
            style={[styles.customerDetail, { color: colors.textSecondary }]}
          >
            {customerEmail}
          </Text>
          <Text
            style={[styles.customerDetail, { color: colors.textSecondary }]}
          >
            {customerPhone}
          </Text>
        </View>
        <Pressable
          disabled={isGeneratingReceipt}
          onPress={onSendReceipt}
          style={[
            styles.receiptButton,
            {
              backgroundColor: isGeneratingReceipt
                ? colors.textMuted
                : colors.primary,
            },
          ]}
        >
          {isGeneratingReceipt ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Ionicons
              color={colors.textOnPrimary}
              name="document-text-outline"
              size={18}
            />
          )}
          <Text
            style={[styles.receiptButtonText, { color: colors.textOnPrimary }]}
          >
            {isGeneratingReceipt ? 'Generating...' : 'Receipt'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actionButtons}>
        <Pressable
          onPress={onCall}
          style={[
            styles.actionButton,
            { backgroundColor: colors.backgroundLight },
          ]}
        >
          <Ionicons color={colors.primary} name="call" size={20} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            Call
          </Text>
        </Pressable>
        <Pressable
          onPress={onWhatsApp}
          style={[
            styles.actionButton,
            { backgroundColor: colors.backgroundLight },
          ]}
        >
          <Ionicons
            color={BRAND_COLORS.whatsapp}
            name="logo-whatsapp"
            size={20}
          />
          <Text
            style={[styles.actionButtonText, { color: BRAND_COLORS.whatsapp }]}
          >
            WhatsApp
          </Text>
        </Pressable>
        <Pressable
          onPress={onEmail}
          style={[
            styles.actionButton,
            { backgroundColor: colors.backgroundLight },
          ]}
        >
          <Ionicons color={colors.textSecondary} name="mail" size={20} />
          <Text
            style={[styles.actionButtonText, { color: colors.textSecondary }]}
          >
            Email
          </Text>
        </Pressable>
      </View>

      {showPostShipmentActions && hasCustomerPhone ? (
        <Pressable
          onPress={onSendOrderDetailsToRider}
          style={[styles.primaryAction, { backgroundColor: colors.gold }]}
        >
          <Ionicons
            color={BRAND_COLORS.whatsapp}
            name="logo-whatsapp"
            size={20}
          />
          <Text style={[styles.primaryActionText, { color: colors.text }]}>
            Send Order Details to Rider
          </Text>
        </Pressable>
      ) : null}

      {showPostShipmentActions ? (
        <Pressable
          onPress={onSendRiderToCustomer}
          style={[
            styles.secondaryAction,
            {
              backgroundColor: colors.backgroundLight,
              borderColor: `${colors.success}30`,
            },
          ]}
        >
          <Ionicons color={colors.success} name="share-social" size={20} />
          <Text style={[styles.secondaryActionText, { color: colors.success }]}>
            Share Rider Details With Customer
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
