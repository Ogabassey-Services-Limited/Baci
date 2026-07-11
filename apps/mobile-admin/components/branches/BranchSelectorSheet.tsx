import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Branch } from '@/schemas/branch';

interface BranchSelectorSheetProps {
  branchId: string | null;
  branches: Branch[];
  isAllLocations: boolean;
  onAddBranch: () => void;
  onClose: () => void;
  onManageBranch: (branch: Branch) => void;
  onSelectAll: () => void;
  onSelectBranch: (branch: Branch) => void;
  visible: boolean;
}

export function BranchSelectorSheet({
  branchId,
  branches,
  isAllLocations,
  onAddBranch,
  onClose,
  onManageBranch,
  onSelectAll,
  onSelectBranch,
  visible,
}: BranchSelectorSheetProps) {
  const { colors } = useTheme();

  const renderCheck = (selected: boolean) => (
    <Ionicons
      name={selected ? 'radio-button-on' : 'radio-button-off'}
      size={20}
      color={selected ? colors.primary : colors.textMuted}
    />
  );

  return (
    <AppSheetModal
      accessibilityLabel="Choose location"
      onClose={onClose}
      visible={visible}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        Choose location
      </Text>

      <View accessibilityRole="radiogroup">
        <Pressable
          accessibilityLabel="Show all branch locations"
          accessibilityRole="radio"
          accessibilityState={{ checked: isAllLocations }}
          onPress={onSelectAll}
          style={({ pressed }) => [
            styles.row,
            pressed && { backgroundColor: colors.cardHover },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="business" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            All locations
          </Text>
          {renderCheck(isAllLocations)}
        </Pressable>

        {branches.map((branch) => {
          const selected = !isAllLocations && branch.id === branchId;
          return (
            <View key={branch.id} style={styles.branchRow}>
              <Pressable
                accessibilityLabel={`Switch to ${branch.name} branch`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => onSelectBranch(branch)}
                style={({ pressed }) => [
                  styles.row,
                  styles.branchRowSelect,
                  pressed && { backgroundColor: colors.cardHover },
                ]}
              >
                <View
                  style={[styles.rowIcon, { backgroundColor: colors.inputBg }]}
                >
                  <Ionicons name="location" size={16} color={colors.primary} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.rowLabel, { color: colors.text }]}
                >
                  {branch.name}
                </Text>
                {renderCheck(selected)}
              </Pressable>
              <Pressable
                accessibilityLabel={`Manage ${branch.name} branch`}
                accessibilityRole="button"
                accessibilityHint="Edit or deactivate this branch"
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                onPress={() => onManageBranch(branch)}
                style={({ pressed }) => [
                  styles.manageButton,
                  { borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Pressable
        accessibilityLabel="Add new branch"
        accessibilityRole="button"
        onPress={onAddBranch}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.rowIcon, { backgroundColor: colors.inputBg }]}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </View>
        <Text style={[styles.rowLabel, { color: colors.primary }]}>
          Add branch
        </Text>
      </Pressable>
    </AppSheetModal>
  );
}

const styles = StyleSheet.create({
  branchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  branchRowSelect: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACING.sm,
  },
  manageButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  row: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.md,
    minHeight: 52,
    paddingHorizontal: SPACING.sm,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rowLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    marginBottom: SPACING.md,
  },
});
