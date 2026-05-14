import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';
import { BranchCard } from '@/components/staff/BranchCard';
import styles from '@/components/staff/staff-accounts.styles';
import type { Branch } from '@/components/staff/types';

interface BranchesTabContentProps {
  activeBranches: Branch[];
  colors: ThemeColors;
  shadows: ThemeShadows;
  onDeactivate: (branchId: string) => void;
  onEdit: (branchId: string) => void;
}

export function BranchesTabContent({
  activeBranches,
  colors,
  shadows,
  onDeactivate,
  onEdit,
}: BranchesTabContentProps) {
  if (activeBranches.length === 0) {
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
          <Ionicons name="business-outline" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No Branches Yet
        </Text>
        <Text
          style={[styles.emptyDescription, { color: colors.textSecondary }]}
        >
          Add store locations to organize staff accounts.
        </Text>
      </View>
    );
  }

  return (
    <>
      {activeBranches.map((branch) => (
        <BranchCard
          key={branch.id}
          branch={branch}
          colors={colors}
          shadows={shadows}
          canDeactivate={activeBranches.length > 1}
          onDeactivate={onDeactivate}
          onEdit={onEdit}
        />
      ))}
    </>
  );
}
