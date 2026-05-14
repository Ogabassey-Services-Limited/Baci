import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { expenseFormStyles } from '@/components/expenses/expense-form.styles';
import { useTheme } from '@/hooks/useTheme';

export interface ExpenseBranchOption {
  id: string;
  name: string;
}

interface ExpenseBranchSelectorProps {
  branches: ExpenseBranchOption[];
  selectedBranchId: string | null;
  onSelect: (branchId: string) => void;
}

export function ExpenseBranchSelector({
  branches,
  selectedBranchId,
  onSelect,
}: ExpenseBranchSelectorProps) {
  const { colors } = useTheme();

  if (branches.length <= 1) {
    return null;
  }

  return (
    <View style={expenseFormStyles.section}>
      <Text style={[expenseFormStyles.label, { color: colors.textSecondary }]}>
        Branch <Text style={{ color: colors.error }}>*</Text>
      </Text>
      <View
        accessibilityLabel="Branch"
        accessibilityRole="radiogroup"
        style={expenseFormStyles.branchList}
      >
        {branches.map((branch) => {
          const selected = branch.id === selectedBranchId;

          return (
            <Pressable
              accessibilityHint="Select to assign this expense to the branch"
              accessibilityLabel={`Assign expense to ${branch.name}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={branch.id}
              onPress={() => {
                if (!selected) {
                  onSelect(branch.id);
                }
              }}
              style={[
                expenseFormStyles.branchOption,
                {
                  backgroundColor: colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[expenseFormStyles.optionText, { color: colors.text }]}
              >
                {branch.name}
              </Text>
              <Ionicons
                color={selected ? colors.primary : colors.textSecondary}
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
