import { Pressable, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { paymentMethodSelectorStyles as styles } from './styles';
import type { PaymentTab } from './types';

type ThemeColors = (typeof Colors)['light'];

interface PaymentMethodTabSelectorProps {
  colors: ThemeColors;
  hasBNPLMethods: boolean;
  hasPayLaterMethods: boolean;
  onSelectTab: (tab: PaymentTab) => void;
  selectedTab: PaymentTab;
}

export function PaymentMethodTabSelector({
  colors,
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
          selectedTab === 'full' && [
            styles.activeTab,
            { backgroundColor: BRAND.primary },
          ],
        ]}
        onPress={() => onSelectTab('full')}
        accessibilityRole="tab"
        accessibilityState={{ selected: selectedTab === 'full' }}
        accessibilityLabel="Full Payment"
      >
        <Text
          style={[
            styles.tabText,
            { color: selectedTab === 'full' ? colors.white : colors.text },
          ]}
        >
          Full Payment
        </Text>
      </Pressable>

      {hasBNPLMethods ? (
        <Pressable
          style={[
            styles.tab,
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
            style={[
              styles.tabText,
              {
                color:
                  selectedTab === 'installments' ? colors.white : colors.text,
              },
            ]}
          >
            Pay in Installments
          </Text>
        </Pressable>
      ) : null}

      {hasPayLaterMethods ? (
        <Pressable
          style={[
            styles.tab,
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
            style={[
              styles.tabText,
              {
                color: selectedTab === 'pay_later' ? colors.white : colors.text,
              },
            ]}
          >
            Pay Later
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
