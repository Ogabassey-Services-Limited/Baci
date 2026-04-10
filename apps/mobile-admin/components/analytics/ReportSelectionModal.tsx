import type { MerchantAnalyticsResponse } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import {
  generateReport,
  type ReportType,
  type Transaction,
} from './ReportsGenerator';

interface TaxLedgerOrderRow {
  id: string;
  created_at: string;
  total: number | null;
  tax_amount: number | null;
  customer:
    | { first_name: string | null; last_name: string | null }
    | Array<{ first_name: string | null; last_name: string | null }>
    | null;
}

function mapRowToTransaction(row: TaxLedgerOrderRow): Transaction {
  const joinedCustomer = Array.isArray(row.customer)
    ? row.customer[0]
    : row.customer;
  return {
    id: row.id,
    created_at: row.created_at,
    total: Number(row.total ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    customer: joinedCustomer
      ? {
          first_name: joinedCustomer.first_name ?? undefined,
          last_name: joinedCustomer.last_name ?? undefined,
        }
      : undefined,
  };
}

interface ReportSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  analyticsData: MerchantAnalyticsResponse;
  merchantId: string;
  merchantName: string;
  startDate: Date;
  endDate: Date;
}

export default function ReportSelectionModal({
  visible,
  onClose,
  analyticsData,
  merchantId,
  merchantName,
  startDate,
  endDate,
}: ReportSelectionModalProps) {
  const { colors, isDark } = useTheme();
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const handleGenerate = async (type: ReportType) => {
    setLoading(true);
    try {
      let transactions: Transaction[] = [];

      if (type === 'tax_ledger') {
        const { data, error } = await supabase
          .from('orders')
          .select(`
                        id,
                        created_at,
                        total,
                        tax_amount,
                        customer:customers(first_name, last_name)
                    `)
          .eq('merchant_id', merchantId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: false });

        if (error) throw error;
        transactions = (data ?? []).map(mapRowToTransaction);
      }

      await generateReport(type, {
        title: type === 'executive' ? 'Executive Summary' : 'Sales Tax Ledger',
        startDate,
        endDate,
        merchantName,
        currency,
        data: analyticsData,
        transactions,
      });
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.modal, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Export Report
          </Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Pressable
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { backgroundColor: colors.cardHover },
            ]}
            onPress={() => handleGenerate('executive')}
            disabled={loading}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="stats-chart" size={24} color={colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Executive Summary
              </Text>
              <Text
                style={[styles.optionSubtitle, { color: colors.textSecondary }]}
              >
                Revenue, profit, and top performers
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { backgroundColor: colors.cardHover },
            ]}
            onPress={() => handleGenerate('tax_ledger')}
            disabled={loading}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="document-text" size={24} color={colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Tax & Sales Ledger
              </Text>
              <Text
                style={[styles.optionSubtitle, { color: colors.textSecondary }]}
              >
                Detailed transaction list for audits
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        {loading && (
          <View
            style={[
              styles.loader,
              {
                backgroundColor: isDark
                  ? 'rgba(13,13,26,0.9)'
                  : 'rgba(255,255,255,0.9)',
              },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              Generating PDF...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  loaderText: {
    marginTop: 10,
    fontWeight: '500',
  },
});
