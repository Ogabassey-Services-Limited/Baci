import { useEffect, useRef, type MutableRefObject } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { AirtimeForm } from '@/components/utilities/AirtimeForm';
import { BillForm } from '@/components/utilities/BillForm';
import { DataForm } from '@/components/utilities/DataForm';
import { getNetworkProviderId } from '@/components/utilities/utility-purchase.route-params';
import type {
  UtilityPurchaseResult,
  ValidUtilityType,
} from '@/components/utilities/utility-purchase.types';
import type {
  UtilityRepeatDefaults,
  UtilityRepeatRecipient,
} from '@/lib/utility-repeat';

export type UtilityPurchasePagerHandle = {
  setPage: (index: number) => void;
};

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
  onPageScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPageSelected: (event: { nativeEvent: { position: number } }) => void;
  onSuccess: (result: UtilityPurchaseResult) => void;
  pagerRef: MutableRefObject<UtilityPurchasePagerHandle | null>;
  quickRepeat: QuickRepeatState;
  visitedTypes: Record<ValidUtilityType, boolean>;
};

export function UtilityPurchasePager({
  currentType,
  initialPage,
  onPageScroll,
  onPageSelected,
  onSuccess,
  pagerRef,
  quickRepeat,
  visitedTypes,
}: UtilityPurchasePagerProps) {
  const { width: pageWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const handle = {
      setPage: (index: number) => {
        if (pageWidth <= 0) {
          return;
        }

        scrollRef.current?.scrollTo({
          animated: true,
          x: index * pageWidth,
          y: 0,
        });
      },
    };

    pagerRef.current = handle;

    return () => {
      if (pagerRef.current === handle) {
        pagerRef.current = null;
      }
    };
  }, [pageWidth, pagerRef]);

  useEffect(() => {
    if (pageWidth <= 0) {
      return;
    }

    scrollRef.current?.scrollTo({
      animated: false,
      x: initialPage * pageWidth,
      y: 0,
    });
  }, [initialPage, pageWidth]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) {
      return;
    }

    const nextPosition = Math.round(
      event.nativeEvent.contentOffset.x / pageWidth
    );

    onPageSelected({ nativeEvent: { position: nextPosition } });
  };

  const pageStyle = { width: pageWidth };

  return (
    <ScrollView
      ref={scrollRef}
      bounces={false}
      decelerationRate="fast"
      disableIntervalMomentum
      horizontal
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={pageWidth > 0 ? pageWidth : undefined}
      contentOffset={{ x: initialPage * pageWidth, y: 0 }}
      style={{ flex: 1 }}
      testID="utility-purchase-pager"
      onMomentumScrollEnd={handleScrollEnd}
      onScroll={onPageScroll}
      onScrollEndDrag={handleScrollEnd}
    >
      <View key="airtime" collapsable={false} style={[{ flex: 1 }, pageStyle]}>
        {visitedTypes.airtime && (
          <AirtimeForm
            key={`airtime-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialPhoneNumber={quickRepeat.repeatDefaults.phoneNumber}
            initialProvider={getNetworkProviderId(
              quickRepeat.repeatDefaults.networkProvider
            )}
            isRepeatPaymentReady={
              currentType === 'airtime'
                ? quickRepeat.isRepeatPaymentReady
                : false
            }
            recentRecipients={
              currentType === 'airtime' ? quickRepeat.recentRecipients : []
            }
            onSelectRecentRecipient={quickRepeat.handleRecipientSelect}
            onSuccess={onSuccess}
          />
        )}
      </View>
      <View key="data" collapsable={false} style={[{ flex: 1 }, pageStyle]}>
        {visitedTypes.data && (
          <DataForm
            key={`data-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialPhoneNumber={quickRepeat.repeatDefaults.phoneNumber}
            initialPlan={quickRepeat.repeatDefaults.dataPlanCode}
            initialProvider={quickRepeat.repeatDefaults.networkProvider}
            isRepeatPaymentReady={
              currentType === 'data' ? quickRepeat.isRepeatPaymentReady : false
            }
            recentRecipients={
              currentType === 'data' ? quickRepeat.recentRecipients : []
            }
            onSelectRecentRecipient={quickRepeat.handleRecipientSelect}
            onSuccess={onSuccess}
          />
        )}
      </View>
      <View key="tv" collapsable={false} style={[{ flex: 1 }, pageStyle]}>
        {visitedTypes.tv && (
          <BillForm
            key={`tv-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialBillerName={quickRepeat.repeatDefaults.billerName}
            initialBillItemIdentifier={
              quickRepeat.repeatDefaults.billItemIdentifier
            }
            initialCustomerIdentifier={
              quickRepeat.repeatDefaults.customerIdentifier
            }
            initialCustomerName={quickRepeat.repeatDefaults.customerName}
            isRepeatPaymentReady={
              currentType === 'tv' ? quickRepeat.isRepeatPaymentReady : false
            }
            recentRecipients={
              currentType === 'tv' ? quickRepeat.recentRecipients : []
            }
            onSelectRecentRecipient={quickRepeat.handleRecipientSelect}
            type="tv"
            onSuccess={onSuccess}
          />
        )}
      </View>
      <View key="power" collapsable={false} style={[{ flex: 1 }, pageStyle]}>
        {visitedTypes.power && (
          <BillForm
            key={`power-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialBillerName={quickRepeat.repeatDefaults.billerName}
            initialBillItemIdentifier={
              quickRepeat.repeatDefaults.billItemIdentifier
            }
            initialCustomerIdentifier={
              quickRepeat.repeatDefaults.customerIdentifier
            }
            initialCustomerName={quickRepeat.repeatDefaults.customerName}
            isRepeatPaymentReady={
              currentType === 'power' ? quickRepeat.isRepeatPaymentReady : false
            }
            recentRecipients={
              currentType === 'power' ? quickRepeat.recentRecipients : []
            }
            onSelectRecentRecipient={quickRepeat.handleRecipientSelect}
            type="power"
            onSuccess={onSuccess}
          />
        )}
      </View>
      <View key="gaming" collapsable={false} style={[{ flex: 1 }, pageStyle]}>
        {visitedTypes.gaming && (
          <BillForm
            key={`gaming-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialBillerName={quickRepeat.repeatDefaults.billerName}
            initialBillItemIdentifier={
              quickRepeat.repeatDefaults.billItemIdentifier
            }
            initialCustomerIdentifier={
              quickRepeat.repeatDefaults.customerIdentifier
            }
            initialCustomerName={quickRepeat.repeatDefaults.customerName}
            isRepeatPaymentReady={
              currentType === 'gaming'
                ? quickRepeat.isRepeatPaymentReady
                : false
            }
            recentRecipients={
              currentType === 'gaming' ? quickRepeat.recentRecipients : []
            }
            onSelectRecentRecipient={quickRepeat.handleRecipientSelect}
            type="gaming"
            onSuccess={onSuccess}
          />
        )}
      </View>
    </ScrollView>
  );
}
