import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { BillerList } from './BillerList';
import { BillItemSelectionSection } from './BillItemSelectionSection';
import { BillPaymentFooter } from './BillPaymentFooter';
import { BillPaymentSection } from './BillPaymentSection';
import { billFormStyles as styles } from './bill-form-styles';
import type { BillFormProps } from './bill-form.types';
import { useBillFormController } from './use-bill-form-controller';
import { ScrollView, View } from 'react-native';

export function BillForm(props: BillFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const form = useBillFormController(props);

  return (
    <>
      <ScrollView
        ref={form.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: form.footerSpacerHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <BillerList
          billers={form.billersQuery.data || []}
          selectedBillerId={form.selectedBiller?.billerId ?? null}
          onSelect={form.handleBillerSelect}
          isLoading={form.billersQuery.isLoading}
          isCollapsed={!!form.selectedBiller && !form.isProviderPickerExpanded}
          onChangeSelection={() => {
            form.setIsRepeatPaymentActive(false);
            form.setIsProviderPickerExpanded(true);
          }}
          errorMessage={
            form.billersQuery.isError
              ? form.billersQuery.error instanceof Error
                ? form.billersQuery.error.message
                : 'Failed to load providers. Please try again.'
              : undefined
          }
        />

        {form.selectedBiller ? (
          <View
            onLayout={(event) => {
              if (form.shouldScrollToNextStep) {
                form.scheduleNextStepScroll(event.nativeEvent.layout.y);
              }
            }}
          >
            <BillItemSelectionSection
              billItemSelection={form.billItemSelection}
              colors={colors}
              customerId={form.customerId}
              handleBillItemSelect={form.handleBillItemSelect}
              handleVerify={form.handleVerify}
              isBillItemSelectionComplete={form.isBillItemSelectionComplete}
              isRepeatPaymentActive={form.isRepeatPaymentActive}
              resetVerification={form.resetVerification}
              selectedBillItemIdentifier={form.selectedBillItemIdentifier}
              selectedBillerId={form.selectedBiller.billerId}
              setCustomerId={form.setCustomerId}
              setIsRepeatPaymentActive={form.setIsRepeatPaymentActive}
              type={props.type}
              verify={form.verify}
            />
          </View>
        ) : null}

        {form.canShowPayment ? (
          <BillPaymentSection
            colors={colors}
            formattedAmount={form.formattedAmount}
            handlePaymentLayout={form.handlePaymentLayout}
            isFixedAmount={form.isFixedAmount}
            numericAmount={form.numericAmount}
            payment={form.payment}
            setAmount={form.setAmount}
          />
        ) : null}
      </ScrollView>

      {form.canShowPayment ? (
        <BillPaymentFooter
          colors={colors}
          footerBottomOffset={form.footerBottomOffset}
          insetsBottom={form.insets.bottom}
          isBusy={form.isBusy}
          isKeyboardVisible={form.isKeyboardVisible}
          numericAmount={form.numericAmount}
          onPurchase={form.handlePurchase}
          payment={form.payment}
        />
      ) : null}
    </>
  );
}
