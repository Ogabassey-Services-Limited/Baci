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

const TAB_LABELS: Record<PaymentTab, string> = {
  full: 'Pay\nin full',
  installments: 'Pay\nin Installments',
  pay_later: 'Pay\nLater',
};

function getTabLabel(tab: PaymentTab): string {
  return TAB_LABELS[tab];
}

function getAccessibleTabLabel(tab: PaymentTab): string {
  return getTabLabel(tab).replace(/\s+/g, ' ').replace(/\.+$/, '');
}

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
      style={[
        styles.tabContainer,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
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
        accessibilityLabel={getAccessibleTabLabel('full')}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={2}
          style={[
            styles.tabText,
            compact && styles.compactTabText,
            { color: selectedTab === 'full' ? colors.white : colors.text },
          ]}
        >
          {getTabLabel('full')}
        </Text>
      </Pressable>
      {(hasBNPLMethods || hasPayLaterMethods) && (
        <View
          style={[styles.tabSeparator, { backgroundColor: colors.border }]}
          testID="payment-tab-separator"
        />
      )}

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
          accessibilityLabel={getAccessibleTabLabel('installments')}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            style={[
              styles.tabText,
              compact && styles.compactTabText,
              {
                color:
                  selectedTab === 'installments' ? colors.white : colors.text,
              },
            ]}
          >
            {getTabLabel('installments')}
          </Text>
        </Pressable>
      ) : null}
      {hasBNPLMethods && hasPayLaterMethods ? (
        <View
          style={[styles.tabSeparator, { backgroundColor: colors.border }]}
          testID="payment-tab-separator"
        />
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
          accessibilityLabel={getAccessibleTabLabel('pay_later')}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            style={[
              styles.tabText,
              compact && styles.compactTabText,
              {
                color: selectedTab === 'pay_later' ? colors.white : colors.text,
              },
            ]}
          >
            {getTabLabel('pay_later')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
