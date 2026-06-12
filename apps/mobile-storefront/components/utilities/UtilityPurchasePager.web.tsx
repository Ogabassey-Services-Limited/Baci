import React from 'react';
import { View } from 'react-native';
import type PagerView from 'react-native-pager-view';
import type {
  UtilityPurchaseResult,
  ValidUtilityType,
} from './utility-purchase.types';
import type {
  UtilityRepeatDefaults,
  UtilityRepeatRecipient,
} from '@/lib/utility-repeat';

type QuickRepeatState = {
  handleRecipientSelect: (recipient: UtilityRepeatRecipient) => void;
  isRepeatPaymentReady: boolean;
  recentRecipients: UtilityRepeatRecipient[];
  repeatDefaults: UtilityRepeatDefaults;
  repeatRevision: number;
};

type UtilityPurchasePagerProps = {
  currentType: ValidUtilityType;
  initialPage: number;
  onPageScroll: (event: unknown) => void;
  onPageSelected: (event: { nativeEvent: { position: number } }) => void;
  onSuccess: (result: UtilityPurchaseResult) => void;
  pagerRef: React.RefObject<PagerView | null>;
  quickRepeat: QuickRepeatState;
  visitedTypes: Record<ValidUtilityType, boolean>;
};

export function UtilityPurchasePager({
  currentType: _currentType,
  initialPage: _initialPage,
  onPageScroll: _onPageScroll,
  onPageSelected: _onPageSelected,
  onSuccess: _onSuccess,
  pagerRef: _pagerRef,
  quickRepeat: _quickRepeat,
  visitedTypes: _visitedTypes,
}: UtilityPurchasePagerProps) {
  // Web/SSR-safe fallback
  return (
    <View style={{ flex: 1 }} testID="pager-view-web">
      <View style={{ flex: 1 }} />
    </View>
  );
}
