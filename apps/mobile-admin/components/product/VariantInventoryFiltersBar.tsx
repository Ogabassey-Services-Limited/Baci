import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { SPACING } from '@/constants/theme';
import type { Branch } from '@/schemas/branch';
import type { VariantInventoryStatus } from '@/hooks/variantInventory';
import { CENTRAL_STOCK_BRANCH_ID } from './VariantInventory.constants';
import { variantInventoryUnitsSheetStyles as styles } from './VariantInventoryUnitsSheet.styles';

const statusFilters = [
  'available',
  'reserved',
  'sold',
  'returned',
  'defective',
] as const satisfies readonly VariantInventoryStatus[];

interface VariantInventoryFiltersBarProps {
  branchFilter: string | null;
  branches: Branch[];
  colors: ThemeColors;
  onBranchFilterChange: (branchId: string | null) => void;
  onStatusFilterChange: (status: VariantInventoryStatus | null) => void;
  statusFilter: VariantInventoryStatus | null;
}

function filterTextStyle(
  colors: ThemeColors,
  isSelected: boolean
): { color: string; fontSize: number; fontWeight: '600' } {
  return {
    color: isSelected ? colors.textOnPrimary : colors.text,
    fontSize: 12,
    fontWeight: '600',
  };
}

function filterTabStyle(colors: ThemeColors, isSelected: boolean) {
  return [
    styles.filterTab,
    { borderColor: colors.border },
    isSelected && {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  ];
}

export function VariantInventoryFiltersBar({
  branchFilter,
  branches,
  colors,
  onBranchFilterChange,
  onStatusFilterChange,
  statusFilter,
}: VariantInventoryFiltersBarProps) {
  return (
    <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
      <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
        Filter By Status
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        <Pressable
          accessibilityLabel="Filter by all statuses"
          accessibilityRole="button"
          onPress={() => onStatusFilterChange(null)}
          style={filterTabStyle(colors, statusFilter === null)}
        >
          <Text style={filterTextStyle(colors, statusFilter === null)}>
            All Statuses
          </Text>
        </Pressable>
        {statusFilters.map((status) => (
          <Pressable
            accessibilityLabel={`Filter by ${status}`}
            accessibilityRole="button"
            key={status}
            onPress={() => onStatusFilterChange(status)}
            style={filterTabStyle(colors, statusFilter === status)}
          >
            <Text style={filterTextStyle(colors, statusFilter === status)}>
              {status.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {branches.length > 0 ? (
        <>
          <Text
            style={[
              styles.filterLabel,
              { color: colors.textSecondary, marginTop: SPACING.sm },
            ]}
          >
            Filter By Branch
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <Pressable
              accessibilityLabel="Filter by all branches"
              accessibilityRole="button"
              onPress={() => onBranchFilterChange(null)}
              style={filterTabStyle(colors, branchFilter === null)}
            >
              <Text style={filterTextStyle(colors, branchFilter === null)}>
                All Branches
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Filter by Central Stock"
              accessibilityRole="button"
              onPress={() => onBranchFilterChange(CENTRAL_STOCK_BRANCH_ID)}
              style={filterTabStyle(
                colors,
                branchFilter === CENTRAL_STOCK_BRANCH_ID
              )}
            >
              <Text
                style={filterTextStyle(
                  colors,
                  branchFilter === CENTRAL_STOCK_BRANCH_ID
                )}
              >
                Central Stock
              </Text>
            </Pressable>
            {branches.map((branch) => (
              <Pressable
                accessibilityLabel={`Filter by ${branch.name}`}
                accessibilityRole="button"
                key={branch.id}
                onPress={() => onBranchFilterChange(branch.id)}
                style={filterTabStyle(colors, branchFilter === branch.id)}
              >
                <Text
                  style={filterTextStyle(colors, branchFilter === branch.id)}
                >
                  {branch.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}
