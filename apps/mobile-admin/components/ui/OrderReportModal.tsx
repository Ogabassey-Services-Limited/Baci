import type { Order } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { orderExportTools } from '@/utils/export-orders';
import { formatCurrency } from '@/utils/format';

const PRESETS = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'This Month',
];

interface OrderReportModalProps {
  visible: boolean;
  onClose: () => void;
  onExport: () => Promise<void>;
  orders: Order[];
  dateRangeLabel: string;
  businessName: string;
  logoUrl?: string;
  onDateSelect?: () => void;
  onPresetSelect?: (preset: string) => void;
}

export default function OrderReportModal({
  visible,
  onClose,
  onExport,
  orders,
  dateRangeLabel,
  businessName,
  logoUrl,
  onDateSelect,
  onPresetSelect,
}: OrderReportModalProps) {
  const { colors, shadows } = useTheme();
  // ... existing stats logic ...
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const screenHeight = Dimensions.get('window').height;

  // Calculate stats
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (Number(o.total) || 0),
    0
  );
  const pendingCount = orders.filter(
    (o) => o.shipping_status === 'pending'
  ).length;
  const completedCount = orders.filter(
    (o) => o.shipping_status === 'delivered'
  ).length;

  const stats = { totalOrders, totalRevenue, pendingCount, completedCount };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await orderExportTools.exportOrderReportPDF(
        orders,
        dateRangeLabel,
        businessName,
        logoUrl
      );
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => {
          setShowDropdown(false);
          onClose();
        }}
      >
        <Pressable
          style={[
            styles.container,
            { backgroundColor: colors.card, maxHeight: screenHeight * 0.8 },
            shadows.lg,
          ]}
          onPress={(e) => {
            if (showDropdown) setShowDropdown(false);
            e.stopPropagation();
          }}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACING.sm,
              }}
            >
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons
                  name="document-text"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Orders Report
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close report"
              accessibilityHint="Closes the report modal"
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={[styles.content, { zIndex: 1 }]}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: SPACING.md,
                zIndex: 2,
              }}
            >
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.textSecondary, marginBottom: 0 },
                ]}
              >
                Summary for:{' '}
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
                  }}
                >
                  {dateRangeLabel}
                </Text>
              </Text>

              <View style={{ zIndex: 3 }}>
                {onDateSelect && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setShowDropdown(!showDropdown);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      padding: 4,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Change date range"
                    accessibilityHint="Opens date range preset menu"
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: TYPOGRAPHY.size.sm,
                        fontFamily: TYPOGRAPHY.fontFamily.medium,
                      }}
                    >
                      Change
                    </Text>
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={colors.primary}
                    />
                  </Pressable>
                )}

                {/* Dropdown Menu */}
                {showDropdown && (
                  <View
                    style={[
                      styles.dropdown,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      shadows.md,
                    ]}
                  >
                    {PRESETS.map((preset) => (
                      <Pressable
                        key={preset}
                        style={[
                          styles.dropdownItem,
                          { borderBottomColor: `${colors.border}40` },
                        ]}
                        onPress={() => {
                          setShowDropdown(false);
                          onPresetSelect?.(preset);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${preset}`}
                      >
                        <Text
                          style={[styles.dropdownText, { color: colors.text }]}
                        >
                          {preset}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      style={[styles.dropdownItem, { borderBottomWidth: 0 }]}
                      onPress={() => {
                        setShowDropdown(false);
                        onDateSelect?.();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Select custom date range"
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          {
                            color: colors.primary,
                            fontFamily: TYPOGRAPHY.fontFamily.semiBold,
                          },
                        ]}
                      >
                        Custom Range...
                      </Text>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={colors.primary}
                      />
                    </Pressable>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.statsGrid}>
              {/* ... rest of grid ... */}
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.background },
                ]}
              >
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Total Revenue
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatCurrency(stats.totalRevenue)}
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.background },
                ]}
              >
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Total Orders
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stats.totalOrders}
                </Text>
              </View>
            </View>

            {/* ... rest of content ... */}
            <View style={[styles.statsRow, { borderColor: colors.border }]}>
              <View
                style={[
                  styles.miniStat,
                  { borderColor: colors.border, borderRightWidth: 1 },
                ]}
              >
                <Text style={[styles.miniValue, { color: colors.warning }]}>
                  {stats.pendingCount}
                </Text>
                <Text
                  style={[styles.miniLabel, { color: colors.textSecondary }]}
                >
                  Pending
                </Text>
              </View>
              <View style={[styles.miniStat]}>
                <Text style={[styles.miniValue, { color: colors.success }]}>
                  {stats.completedCount}
                </Text>
                <Text
                  style={[styles.miniLabel, { color: colors.textSecondary }]}
                >
                  Delivered
                </Text>
              </View>
            </View>

            <View
              style={[styles.infoBox, { backgroundColor: colors.infoLight }]}
            >
              <Ionicons
                name="information-circle"
                size={20}
                color={colors.info}
              />
              <Text style={[styles.infoText, { color: colors.info }]}>
                Exporting will capture all {stats.totalOrders} currently loaded
                orders.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {/* CSV Button (Secondary) */}
            <Pressable
              style={[
                styles.button,
                { borderColor: colors.border, borderWidth: 1, marginRight: 8 },
              ]}
              onPress={handleExport}
              disabled={isExporting || isExportingPDF}
              accessibilityRole="button"
              accessibilityLabel="Export as CSV"
              accessibilityState={{
                disabled: isExporting || isExportingPDF,
                busy: isExporting,
              }}
            >
              {isExporting ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  CSV
                </Text>
              )}
            </Pressable>

            {/* PDF Button (Primary) */}
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: isExporting || isExportingPDF ? 0.7 : 1,
                  flex: 2,
                },
              ]}
              onPress={handleExportPDF}
              disabled={isExporting || isExportingPDF}
              accessibilityRole="button"
              accessibilityLabel="Download PDF Report"
              accessibilityState={{
                disabled: isExporting || isExportingPDF,
                busy: isExportingPDF,
              }}
            >
              {isExportingPDF ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.buttonText, { color: '#FFF' }]}>
                    Download PDF Report
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  container: {
    borderRadius: RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  content: {
    padding: SPACING.lg,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  miniStat: {
    flex: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  miniLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 11,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  exportButton: {},
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  dropdown: {
    position: 'absolute',
    top: 25,
    right: 0,
    minWidth: 160,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 4,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  dropdownText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
