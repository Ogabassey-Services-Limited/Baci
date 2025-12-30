/**
 * Order Details Screen
 * Premium design with real-time data and actionable controls
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  Share,
  Image,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const generateReceiptHtml = (order: any) => {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  const total = formatCurrency(order.total);
  const date = new Date(order.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' });
  const time = new Date(order.created_at).toLocaleTimeString('en-NG', { timeStyle: 'short' });
  const isPaid = order.payment_status === 'paid';
  const documentTitle = isPaid ? 'Receipt' : 'Invoice';
  const watermarkColor = isPaid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)';
  const watermarkBorderColor = isPaid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const watermarkText = isPaid ? 'PAID' : 'UNPAID';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #f8fafc;
            padding: 24px;
            color: #1f2937;
          }
          .receipt-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e5e7eb;
            overflow: hidden;
            position: relative;
          }
          .top-stripe {
            height: 6px;
            background: linear-gradient(90deg, #dc2626, #ef4444);
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 64px;
            font-weight: 900;
            color: ${watermarkColor};
            border: 5px dashed ${watermarkBorderColor};
            border-radius: 12px;
            padding: 8px 24px;
            pointer-events: none;
            white-space: nowrap;
            letter-spacing: 4px;
          }
          .content { padding: 32px; position: relative; z-index: 1; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .logo { font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .doc-type { text-align: right; }
          .doc-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: ${isPaid ? '#9ca3af' : '#dc2626'}; margin-bottom: 4px; }
          .doc-number { font-size: 14px; font-weight: 700; color: #111827; }
          .amount-section { text-align: center; padding: 24px 0; margin-bottom: 24px; border-bottom: 2px dashed #e5e7eb; }
          .amount-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
          .amount-value { font-size: 36px; font-weight: 800; color: ${isPaid ? '#111827' : '#dc2626'}; }
          .amount-date { font-size: 12px; color: #9ca3af; margin-top: 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
          .info-value { font-size: 14px; font-weight: 600; color: #111827; }
          .info-sub { font-size: 12px; color: #6b7280; margin-top: 2px; line-height: 1.4; }
          .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 12px; }
          .product-card { background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
          .product-row { display: flex; justify-content: space-between; align-items: flex-start; }
          .product-name { font-size: 14px; font-weight: 600; color: #111827; }
          .product-qty { font-size: 12px; color: #6b7280; margin-top: 2px; }
          .product-price { font-size: 14px; font-weight: 700; color: #111827; }
          .footer { text-align: center; padding-top: 24px; border-top: 1px solid #f3f4f6; margin-top: 24px; }
          .footer-help { font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
          .footer-contact { font-size: 12px; font-weight: 700; color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="top-stripe"></div>
          <div class="watermark">${watermarkText}</div>
          <div class="content">
            <div class="header">
              <div class="logo">OGABASSEY</div>
              <div class="doc-type">
                <div class="doc-label">${documentTitle}</div>
                <div class="doc-number">#${order.order_number}</div>
              </div>
            </div>

            <div class="amount-section">
              <div class="amount-label">${isPaid ? 'Total Amount' : 'Total to Pay'}</div>
              <div class="amount-value">${total}</div>
              <div class="amount-date">${date} • ${time}</div>
            </div>

            <div class="info-grid">
              <div>
                <div class="info-label">Billed To</div>
                <div class="info-value">${order.customer_name}</div>
                <div class="info-sub">${order.customer_email}</div>
                <div class="info-sub">${order.customer_phone}</div>
              </div>
              <div style="text-align: right;">
                <div class="info-label">Payment Method</div>
                <div class="info-value">${order.payment_method || 'N/A'}</div>
                <div class="info-sub">${isPaid ? 'Verified' : 'Pending'}</div>
              </div>
            </div>

            <div class="section-label">Product Details</div>
            ${order.items.map((item: any) => `
              <div class="product-card">
                <div class="product-row">
                  <div>
                    <div class="product-name">${item.product_name}</div>
                    <div class="product-qty">Qty: ${item.quantity}</div>
                  </div>
                  <div class="product-price">${formatCurrency(item.price * item.quantity)}</div>
                </div>
              </div>
            `).join('')}

            <div class="footer">
              <div class="footer-help">Questions regarding this ${documentTitle.toLowerCase()}?</div>
              <div class="footer-contact">help@ogabassey.com • +234 814 697 8921</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};


import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
// BlurView removed as it is not installed/used
import { useTheme } from '@/hooks/useTheme';
import {
  useOrder,
  useUpdateOrderStatus,
  type ShippingStatus,
  type PaymentStatus
} from '@/hooks/useOrders';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import {
  SHIPPING_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  ORDER_SOURCE_CONFIG,
  BRAND_COLORS
} from '@baci/shared';

// Helper to get consistent theme colors for statuses
const getStatusColor = (key: string | undefined, colors: any) => {
  const colorMap: Record<string, string> = {
    pending: colors.pending,
    processing: colors.processing,
    shipped: colors.shipped,
    delivered: colors.delivered,
    cancelled: colors.cancelled,
    returned: colors.returned || colors.textMuted,
    paid: colors.success,
    unpaid: colors.error,
    refunded: colors.textMuted,
  };
  return colorMap[key || ''] || colors.textSecondary;
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams();
  const orderId = Array.isArray(id) ? id[0] : id;
  const { colors, shadows, isDark } = useTheme();

  // Data Fetching
  const { data: order, isLoading, error } = useOrder(orderId);
  const updateStatusMutation = useUpdateOrderStatus();

  const [showStatusModal, setShowStatusModal] = useState(false);

  // Formatting Helpers
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  // Actions
  const handleCall = () => {
    if (order?.customer_phone) Linking.openURL(`tel:${order.customer_phone}`);
  };

  const handleEmail = () => {
    if (order?.customer_email) Linking.openURL(`mailto:${order.customer_email}`);
  };

  const handleWhatsApp = () => {
    if (order?.customer_phone) {
      // Remove spaces/special chars from phone
      const phone = order.customer_phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${phone}`);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Order ${order?.order_number} details for ${order?.customer_name}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusUpdate = async (newStatus: ShippingStatus) => {
    if (!order) return;
    try {
      await updateStatusMutation.mutateAsync({ orderId: order.id, status: newStatus });
      setShowStatusModal(false);
      Alert.alert('Success', `Order status updated to ${newStatus}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleSendReceipt = async () => {
    if (!order) return;
    try {
      const html = generateReceiptHtml(order);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate receipt');
    }
  };

  // Loading/Error States
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.text }]}>Failed to load order</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const shippingConfig = SHIPPING_STATUS_CONFIG[order.shipping_status as ShippingStatus] || SHIPPING_STATUS_CONFIG.pending;
  const paymentConfig = PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus] || PAYMENT_STATUS_CONFIG.pending;
  const shippingColor = getStatusColor(shippingConfig.colorKey, colors);
  const paymentColor = getStatusColor(paymentConfig.colorKey, colors);

  // Source Logic (reused/adapted logic)
  const getSourceIcon = (source: string | null) => {
    const s = (source || '').toLowerCase();
    if (s === 'instagram') return { name: 'logo-instagram', color: '#C13584', label: 'Instagram' };
    if (s === 'whatsapp') return { name: 'logo-whatsapp', color: '#25D366', label: 'WhatsApp' };
    if (s === 'mobile_app') return { name: 'phone-portrait-outline', color: colors.primary, label: 'Mobile App' };
    // ... add others as needed or keep simple
    return { name: 'globe-outline', color: colors.textSecondary, label: 'Website' };
  };
  const sourceInfo = getSourceIcon(order.source);

  // Address Helper
  const formatAddress = (addr: any) => {
    if (!addr) return 'No shipping address provided';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      return [addr.address, addr.city, addr.state].filter(Boolean).join(', ');
    }
    return 'Invalid address format';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: order.order_number,
          headerBackTitleVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable onPress={handleShare} style={styles.headerButton}>
              <Ionicons name="share-outline" size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Status Timeline / Key Info */}
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                Placed on {formatDate(order.created_at)}
              </Text>
              <View style={styles.sourceRow}>
                <Ionicons name={sourceInfo.name as any} size={14} color={sourceInfo.color} />
                <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
                  via {sourceInfo.label}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadgeBig, { backgroundColor: shippingColor + '15' }]}>
              <Text style={[styles.statusTextBig, { color: shippingColor }]}>
                {shippingConfig.label}
              </Text>
            </View>
          </View>

          {/* Progress Bar (Visual) */}
          <View style={styles.progressContainer}>
            {['pending', 'processing', 'shipped', 'delivered'].map((step, index) => {
              const currentStepIndex = ['pending', 'processing', 'shipped', 'delivered'].indexOf(order.shipping_status);
              const isActive = index <= currentStepIndex;
              const isLast = index === 3;

              return (
                <React.Fragment key={step}>
                  <View style={[
                    styles.progressDot,
                    { backgroundColor: isActive ? getStatusColor(step, colors) : colors.border }
                  ]}>
                    {isActive && <Ionicons name="checkmark" size={10} color="#FFF" />}
                  </View>
                  {!isLast && (
                    <View style={[
                      styles.progressLine,
                      { backgroundColor: index < currentStepIndex ? getStatusColor(step, colors) : colors.border }
                    ]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
          <Text style={[styles.statusNote, { color: colors.textMuted }]}>
            Latest update: {formatDate(order.updated_at)}
          </Text>
        </View>

        {/* Customer Card */}
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Customer</Text>
          </View>

          <View style={styles.customerRow}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {order.customer_name?.[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={[styles.customerName, { color: colors.text }]}>{order.customer_name}</Text>
              <Text style={[styles.customerDetail, { color: colors.textSecondary }]}>
                {order.customer_email}
              </Text>
              <Text style={[styles.customerDetail, { color: colors.textSecondary }]}>
                {order.customer_phone}
              </Text>
            </View>
            <Pressable
              style={[styles.receiptBtn, { backgroundColor: colors.primary }]}
              onPress={handleSendReceipt}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFF" />
              <Text style={styles.receiptBtnText}>Receipt</Text>
            </Pressable>
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.backgroundLight }]}
              onPress={handleCall}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Call</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.backgroundLight }]}
              onPress={handleWhatsApp}
            >
              <Ionicons name="logo-whatsapp" size={20} color={BRAND_COLORS.whatsapp} />
              <Text style={[styles.actionBtnText, { color: BRAND_COLORS.whatsapp }]}>WhatsApp</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.backgroundLight }]}
              onPress={handleEmail}
            >
              <Ionicons name="mail" size={20} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Email</Text>
            </Pressable>
          </View>
        </View>

        {/* Order Items */}
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Items ({order.items?.length || 0})</Text>
          </View>
          {order.items?.map((item: any, index: number) => (
            <Pressable
              key={item.id}
              style={[
                styles.itemRow,
                index !== (order.items?.length || 0) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
              ]}
              onPress={() => router.push(`/product/${item.product_id}`)}
            >
              <View style={[styles.itemImagePlaceholder, { backgroundColor: colors.backgroundLight }]}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                ) : (
                  <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.itemDetails}>
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                  {item.product_name}
                </Text>
                <Text style={[styles.itemRef, { color: colors.textMuted }]}>SKU: {item.product_id?.slice(0, 8)}...</Text>
                <View style={styles.itemPriceRow}>
                  <Text style={[styles.itemQty, { color: colors.textSecondary }]}>x{item.quantity}</Text>
                  <Text style={[styles.itemPrice, { color: colors.text }]}>{formatPrice(item.price)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        {/* Shipping Card (Full Width) */}
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={18} color={colors.text} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Shipping Address</Text>
          </View>
          <Text style={[styles.addressText, { color: colors.textSecondary }]}>
            {formatAddress(order.shipping_address)}
          </Text>
        </View>

        {/* Order Summary */}
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Order Summary</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(order.subtotal || order.total)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Shipping</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {order.shipping_fee ? formatPrice(order.shipping_fee) : 'Free'}
            </Text>
          </View>

          {order.discount_amount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Discount</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>-{formatPrice(order.discount_amount)}</Text>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />

          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total Order</Text>
            <Text style={[styles.totalValueMain, { color: colors.text }]}>{formatPrice(order.total)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Amount Paid</Text>
              <View style={[styles.statusBadgeSmall, { backgroundColor: paymentColor + '15' }]}>
                <Text style={[styles.statusTextSmall, { color: paymentColor }]}>
                  {paymentConfig.label}
                </Text>
              </View>
            </View>
            <Text style={[styles.summaryValue, { color: colors.success, fontWeight: '700' }]}>
              {formatPrice(order.amount_paid || 0)}
            </Text>
          </View>

          {order.balance > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: colors.text, fontSize: 14 }]}>Balance Due</Text>
              <Text style={[styles.totalValueMain, { color: colors.error, fontSize: 18 }]}>
                {formatPrice(order.balance)}
              </Text>
            </View>
          )}
        </View>

        {/* Buttom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Update Button */}
      <View style={[styles.floatingFooter, { backgroundColor: colors.card, borderTopColor: colors.border }, shadows.lg]}>
        <View style={styles.footerContent}>
          <View>
            <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>Current Status</Text>
            <Text style={[styles.footerStatus, { color: shippingColor }]}>{shippingConfig.label}</Text>
          </View>
          <Pressable
            style={[styles.updateButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowStatusModal(true)}
          >
            <Text style={styles.updateButtonText}>Update Status</Text>
            <Ionicons name="chevron-up" size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* Basic Status Modal (Could be BottomSheet in future) */}
      {showStatusModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowStatusModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Update Order Status</Text>
            {Object.entries(SHIPPING_STATUS_CONFIG).map(([key, config]) => (
              <Pressable
                key={key}
                style={[
                  styles.modalOption,
                  { backgroundColor: order.shipping_status === key ? colors.primary + '10' : 'transparent' }
                ]}
                onPress={() => handleStatusUpdate(key as ShippingStatus)}
              >
                <View style={[styles.modalDot, { backgroundColor: getStatusColor(config.colorKey, colors) }]} />
                <Text style={[
                  styles.modalOptionText,
                  {
                    color: order.shipping_status === key ? colors.primary : colors.text,
                    fontWeight: order.shipping_status === key ? '700' : '400'
                  }
                ]}>
                  {config.label}
                </Text>
                {order.shipping_status === key && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            ))}
            <Pressable style={styles.closeButton} onPress={() => setShowStatusModal(false)}>
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: SPACING.lg, gap: SPACING.lg },
  headerButton: { padding: 8 },
  errorText: { fontSize: 16, marginTop: 12, marginBottom: 24, opacity: 0.7 },
  backButton: { padding: 12 },

  card: { borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.xs },

  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  orderDate: { fontSize: TYPOGRAPHY.size.xs, marginBottom: 4 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: '500' },
  statusBadgeBig: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  statusTextBig: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '700' },
  statusNote: { fontSize: TYPOGRAPHY.size.xs, marginTop: 12, textAlign: 'center' },

  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  progressDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  progressLine: { flex: 1, height: 2, marginHorizontal: -2 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: '700' },

  customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 20, fontWeight: '700' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: TYPOGRAPHY.size.md, fontWeight: '700', marginBottom: 4 },
  customerDetail: { fontSize: TYPOGRAPHY.size.sm, marginBottom: 2 },

  actionButtons: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: RADIUS.md, gap: 6 },
  actionBtnText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: '600' },

  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md },
  receiptBtnText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: '600', color: '#FFF' },

  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center' },
  itemImagePlaceholder: { width: 60, height: 60, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  itemImage: { width: '100%', height: '100%' },
  itemDetails: { flex: 1, justifyContent: 'center' },
  itemName: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '600', marginBottom: 4 },
  itemRef: { fontSize: TYPOGRAPHY.size.xs, marginBottom: 6 },
  itemPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemQty: { fontSize: TYPOGRAPHY.size.sm },
  itemPrice: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '700' },

  splitRow: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1, padding: 16, borderRadius: RADIUS.lg },
  cardTitleSmall: { fontSize: 13, fontWeight: '600' },
  statusBadgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginVertical: 8 },
  statusTextSmall: { fontSize: 11, fontWeight: '700' },
  detailValue: { fontSize: 16, fontWeight: '700' },
  addressText: { fontSize: 13, lineHeight: 18, marginTop: 8 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValueMain: { fontSize: 20, fontWeight: '800' },

  floatingFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 34, borderTopWidth: 1
  },
  footerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 12 },
  footerStatus: { fontSize: 14, fontWeight: '700' },
  updateButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.full, gap: 8 },
  updateButtonText: { color: '#FFF', fontWeight: '600' },

  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8 },
  modalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  modalOptionText: { fontSize: 16, flex: 1 },
  closeButton: { alignItems: 'center', padding: 16, marginTop: 8 },
});
