import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { PurchasesPackage } from 'react-native-purchases';
import { paywallStyles } from './paywall.styles';

interface PaywallPackageListProps {
  colors: ThemeColors;
  packages: PurchasesPackage[];
  selectedPackage: PurchasesPackage | null;
  setSelectedPackage: (pack: PurchasesPackage) => void;
}

function getAnnualSavingsPercent(
  annualPackage: PurchasesPackage,
  packages: PurchasesPackage[]
): number | null {
  const monthlyPackage = packages.find(
    (candidate) => candidate.packageType === 'MONTHLY'
  );
  if (!monthlyPackage) return null;

  const annualPrice = annualPackage.product.price;
  const monthlyPrice = monthlyPackage.product.price;
  if (monthlyPrice <= 0 || annualPrice <= 0) return null;

  const computedPercent = Math.round(
    (1 - annualPrice / (monthlyPrice * 12)) * 100
  );
  if (computedPercent < 1 || computedPercent > 99) return null;

  return computedPercent;
}

export default function PaywallPackageList({
  colors,
  packages,
  selectedPackage,
  setSelectedPackage,
}: PaywallPackageListProps) {
  return (
    <View style={paywallStyles.packageContainer}>
      {packages.map((pack) => {
        const isActive = selectedPackage?.identifier === pack.identifier;
        const isAnnual = pack.packageType === 'ANNUAL';
        const annualSavingsPercent = isAnnual
          ? getAnnualSavingsPercent(pack, packages)
          : null;
        const annualLabelDetail =
          annualSavingsPercent === null
            ? ' per year, best value'
            : ` per year, save ${annualSavingsPercent} percent`;
        const annualBadgeText =
          annualSavingsPercent === null ? 'BEST VALUE' : `SAVE ${annualSavingsPercent}%`;

        return (
          <Pressable
            key={pack.identifier}
            onPress={() => setSelectedPackage(pack)}
            style={[
              paywallStyles.tierCard,
              {
                backgroundColor: colors.card,
                borderColor: isActive ? colors.primary : colors.border,
                borderWidth: isActive ? 2 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${isAnnual ? 'Yearly' : 'Monthly'} subscription at ${pack.product.priceString}${isAnnual ? annualLabelDetail : ' per month'}`}
            accessibilityState={{ selected: isActive }}
          >
            <View style={paywallStyles.tierInfo}>
              <Text style={[paywallStyles.tierTitle, { color: colors.text }]}>
                {isAnnual ? 'Yearly Access' : 'Monthly Access'}
              </Text>
              {isAnnual && (
                <View
                  style={[
                    paywallStyles.savingsBadge,
                    { backgroundColor: colors.success },
                  ]}
                >
                  <Text style={paywallStyles.savingsText}>{annualBadgeText}</Text>
                </View>
              )}
            </View>
            <View style={paywallStyles.tierPricing}>
              <Text style={[paywallStyles.tierPrice, { color: colors.text }]}>
                {pack.product.priceString}
              </Text>
              <Text
                style={[paywallStyles.tierPeriod, { color: colors.textSecondary }]}
              >
                /{isAnnual ? 'year' : 'mo'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
