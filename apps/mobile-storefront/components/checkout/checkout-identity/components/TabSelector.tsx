import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons/static";
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BRAND, palette } from '@/constants/Colors';
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
}

export function TabSelector({ activeTab, onTabChange }: TabSelectorProps) {
  const { triggerHaptic } = useHapticFeedback();

  const handleTabPress = (tabId: TabType) => {
    if (tabId !== activeTab) {
      triggerHaptic('selection');
      onTabChange(tabId);
    }
  };

  return (
    <View
      style={styles.tabContainer}
      accessibilityRole="tablist"
      accessible={false}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
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
              color={isActive ? BRAND.primary : palette.gray[500]}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
