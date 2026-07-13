import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { useHapticFeedback } from '../hooks';
import { styles } from '../styles';

export type TabType = 'new' | 'signin';

interface Tab {
  id: TabType;
  label: string;
  icon: IoniconsIconName;
  accessibilityLabel: string;
}

const TABS: Tab[] = [
  {
    id: 'new',
    label: 'New Customer',
    icon: 'person-add-outline',
    accessibilityLabel: 'New customer options',
  },
  {
    id: 'signin',
    label: 'Sign In',
    icon: 'person-outline',
    accessibilityLabel: 'Sign in to existing account',
  },
];

interface TabSelectorProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  theme: CheckoutIdentityTheme;
}

export function TabSelector({
  activeTab,
  onTabChange,
  theme,
}: TabSelectorProps) {
  const { triggerHaptic } = useHapticFeedback();

  const handleTabPress = (tabId: TabType) => {
    if (tabId !== activeTab) {
      triggerHaptic('selection');
      onTabChange(tabId);
    }
  };

  return (
    <View
      style={[styles.tabContainer, { borderBottomColor: theme.border }]}
      accessibilityRole="tablist"
      accessible={false}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              isActive && [
                styles.tabActive,
                {
                  backgroundColor: theme.primarySubtle,
                  borderBottomColor: theme.primary,
                },
              ],
            ]}
            onPress={() => handleTabPress(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityHint={
              isActive
                ? 'Currently selected'
                : `Double tap to switch to ${tab.label}`
            }
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? theme.primary : theme.mutedText}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text
              style={[
                styles.tabText,
                { color: theme.mutedText },
                isActive && [styles.tabTextActive, { color: theme.primary }],
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
