import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Text, View } from 'react-native';
import { StaffAccountCard } from '@/components/staff/StaffAccountCard';
import styles from '@/components/staff/staff-accounts.styles';
import type { StaffAccount } from '@/components/staff/types';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';

interface StaffAccountsTabContentProps {
  accounts?: StaffAccount[];
  colors: ThemeColors;
  shadows: ThemeShadows;
  onCopyAccountNumber: (value: string) => void;
}

export function StaffAccountsTabContent({
  accounts,
  colors,
  shadows,
  onCopyAccountNumber,
}: StaffAccountsTabContentProps) {
  if (!accounts?.length) {
    return (
      <View
        style={[
          styles.emptyState,
          { backgroundColor: colors.card },
          shadows.sm,
        ]}
      >
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.primaryLight || '#E8F0FE' },
          ]}
        >
          <Ionicons
            name="person-add-outline"
            size={32}
            color={colors.primary}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No Staff Accounts Yet
        </Text>
        <Text
          style={[styles.emptyDescription, { color: colors.textSecondary }]}
        >
          Create accounts to track sales by staff member.
        </Text>
      </View>
    );
  }

  return (
    <>
      {accounts.map((account) => (
        <StaffAccountCard
          key={account.id}
          account={account}
          colors={colors}
          shadows={shadows}
          onCopyAccountNumber={onCopyAccountNumber}
        />
      ))}
    </>
  );
}
