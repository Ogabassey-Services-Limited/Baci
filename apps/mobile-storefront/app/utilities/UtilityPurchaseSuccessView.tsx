import { Stack } from 'expo-router';
import { View } from 'react-native';
import { PurchaseSuccess } from '@/components/utilities/PurchaseSuccess';
import type Colors from '@/constants/Colors';
import { utilityPurchaseStyles as styles } from './utility-purchase.styles';
import type {
  UtilityPurchaseResult,
  ValidUtilityType,
} from './utility-purchase.types';

type UtilityPurchaseSuccessData = Omit<
  UtilityPurchaseResult,
  'cashback' | 'voucherPin'
> & {
  cashback?: UtilityPurchaseResult['cashback'] | null;
  voucherPin?: string | null;
};

interface UtilityPurchaseSuccessViewProps {
  colors: typeof Colors.light | typeof Colors.dark;
  data: UtilityPurchaseSuccessData;
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: bottomPadding,
          paddingTop: headerOffset,
        },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <PurchaseSuccess
        type={type}
        amount={data.amount}
        customerIdentifier={data.customerIdentifier}
        txReference={data.reference}
        cashback={data.cashback ?? null}
        isAuthenticated={isAuthenticated}
        onCreateAccount={onCreateAccount}
        status={data.status}
        voucherPin={data.voucherPin ?? null}
      />
    </View>
  );
}
