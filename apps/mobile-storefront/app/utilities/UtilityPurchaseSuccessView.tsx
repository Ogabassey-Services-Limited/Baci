import { Stack } from 'expo-router';
import { View } from 'react-native';
import Colors from '@/constants/Colors';
import { PurchaseSuccess } from '@/components/utilities/PurchaseSuccess';
import type { SuccessData, ValidUtilityType } from './utility-purchase.types';
import { utilityPurchaseStyles as styles } from './utility-purchase.styles';

interface UtilityPurchaseSuccessViewProps {
  colors: typeof Colors.light;
  data: SuccessData;
  headerOffset: number;
  isAuthenticated: boolean;
  onCreateAccount: () => void;
  type: ValidUtilityType;
  bottomPadding: number;
}

export function UtilityPurchaseSuccessView({
  colors,
  data,
  headerOffset,
  isAuthenticated,
  onCreateAccount,
  type,
  bottomPadding,
}: UtilityPurchaseSuccessViewProps) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.successShell,
          {
            paddingBottom: bottomPadding,
            paddingTop: headerOffset,
          },
        ]}
      >
        <PurchaseSuccess
          type={type}
          amount={data.amount}
          customerIdentifier={data.customerIdentifier}
          txReference={data.reference}
          cashback={data.cashback ?? null}
          isAuthenticated={isAuthenticated}
          onCreateAccount={onCreateAccount}
          status={data.status}
          voucherPin={data.voucherPin}
        />
      </View>
    </View>
  );
}
