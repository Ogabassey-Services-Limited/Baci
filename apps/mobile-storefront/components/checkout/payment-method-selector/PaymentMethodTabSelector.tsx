import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { paymentMethodSelectorStyles as styles } from './styles';
import type { PaymentTab } from './types';

type ThemeColors = (typeof Colors)['light'];

interface PaymentMethodTabSelectorProps {
  colors: ThemeColors;
  compact?: boolean;
  hasBNPLMethods: boolean;
  hasPayLaterMethods: boolean;
  onSelectTab: (tab: PaymentTab) => void;
  selectedTab: PaymentTab;
}

const COMPACT_TAB_LABELS: Record<PaymentTab, string> = {
  full: 'Pay in\nFull',
  installments: 'Pay in\nInstallments',
  pay_later: 'Pay Later',
};

const TAB_LABELS: Record<PaymentTab, string> = {
  full: 'Full Payment',
  installments: 'Pay in Installments',
  pay_later: 'Pay Later',
};

export function PaymentMethodTabSelector({
  colors,
  compact = false,
  hasBNPLMethods,
  hasPayLaterMethods,
  onSelectTab,
  selectedTab,
}: PaymentMethodTabSelectorProps) {
  if (!hasBNPLMethods && !hasPayLaterMethods) {
    return null;
  }

  return (
    <View
      style={[styles.tabContainer, { backgroundColor: colors.card }]}
      accessibilityRole="tablist"
      accessibilityLabel="Payment type"
    >
      <Pressable
        style={[
          styles.tab,
          compact && styles.compactTab,
          selectedTab === 'full' && [
            styles.activeTab,
            { backgroundColor: BRAND.primary },
          ],
        ]}
        onPress={() => onSelectTab('full')}
        accessibilityRole="tab"
        accessibilityState={{ selected: selectedTab === 'full' }}
        accessibilityLabel="Pay in full"
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={compact ? 2 : 1}
          style={[
            styles.tabText,
            compact && styles.compactTabText,
            { color: selectedTab === 'full' ? colors.white : colors.text },
          ]}
        >
          {compact ? COMPACT_TAB_LABELS.full : TAB_LABELS.full}
        </Text>
      </Pressable>

      {hasBNPLMethods ? (
        <Pressable
          style={[
            styles.tab,
            compact && styles.compactTab,
            selectedTab === 'installments' && [
              styles.activeTab,
              { backgroundColor: BRAND.primary },
            ],
          ]}
          onPress={() => onSelectTab('installments')}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'installments' }}
          accessibilityLabel="Pay in installments"
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={compact ? 2 : 1}
            style={[
              styles.tabText,
              compact && styles.compactTabText,
              {
                color:
                  selectedTab === 'installments' ? colors.white : colors.text,
              },
            ]}
          >
            {compact
              ? COMPACT_TAB_LABELS.installments
              : TAB_LABELS.installments}
          </Text>
        </Pressable>
      ) : null}

      {hasPayLaterMethods ? (
        <Pressable
          style={[
            styles.tab,
            compact && styles.compactTab,
            selectedTab === 'pay_later' && [
              styles.activeTab,
              { backgroundColor: BRAND.primary },
            ],
          ]}
          onPress={() => onSelectTab('pay_later')}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'pay_later' }}
          accessibilityLabel="Pay later"
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={compact ? 2 : 1}
            style={[
              styles.tabText,
              compact && styles.compactTabText,
              {
                color: selectedTab === 'pay_later' ? colors.white : colors.text,
              },
            ]}
          >
            {compact ? COMPACT_TAB_LABELS.pay_later : TAB_LABELS.pay_later}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
