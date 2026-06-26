import { type ReactNode, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import { UtilitiesReceiptsView } from './UtilitiesReceiptsView';

const TABS = ['Devices', 'Utilities'] as const;

interface ReceiptsTabsProps {
  colors: typeof Colors.light;
  /** The Devices (order receipts) page content. */
  devicesContent: ReactNode;
}

export function ReceiptsTabs({ colors, devicesContent }: ReceiptsTabsProps) {
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goToTab = (index: number) => {
    setActiveIndex(index);
    pagerRef.current?.setPage(index);
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.segment, { borderBottomColor: colors.border }]}
        accessibilityRole="tablist"
      >
        {TABS.map((label, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={label}
              style={[
                styles.segmentItem,
                {
                  borderBottomColor: isActive ? BRAND.primary : 'transparent',
                },
              ]}
              onPress={() => goToTab(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${label} receipts`}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: isActive ? colors.text : colors.textSecondary,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
      >
        <View key="devices" collapsable={false} style={styles.page}>
          {devicesContent}
        </View>
        <View key="utilities" collapsable={false} style={styles.page}>
          <UtilitiesReceiptsView colors={colors} />
        </View>
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segment: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2.5,
  },
  segmentText: {
    fontSize: 15,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
