import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

interface NewOrderBranch {
  id: string;
  name: string;
}

interface NewOrderBranchSelectorColors {
  background: string;
  backgroundLight: string;
  border: string;
  primary: string;
  text: string;
  textOnPrimary: string;
}

interface NewOrderBranchSelectorStyles {
  iconBox: StyleProp<ViewStyle>;
  listLabel: StyleProp<TextStyle>;
  listRow: StyleProp<ViewStyle>;
}

interface NewOrderBranchSelectorProps {
  branches: NewOrderBranch[];
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string) => void;
  colors: NewOrderBranchSelectorColors;
  styles: NewOrderBranchSelectorStyles;
}

export function NewOrderBranchSelector({
  branches,
  selectedBranchId,
  setSelectedBranchId,
  colors,
  styles,
}: NewOrderBranchSelectorProps) {
  if (branches.length <= 1) {
    return null;
  }

  return (
    <View
      style={[
        styles.listRow,
        { borderTopColor: colors.border, borderTopWidth: 1 },
      ]}
    >
      <View
        style={[styles.iconBox, { backgroundColor: colors.backgroundLight }]}
      >
        <Ionicons color={colors.primary} name="business" size={20} />
      </View>
      <View style={localStyles.branchContainer}>
        <Text style={[styles.listLabel, { color: colors.text }]}>Branch</Text>
        <View accessibilityRole="radiogroup" style={localStyles.radioGroup}>
          {branches.map((branch) => {
            const isSelected = branch.id === selectedBranchId;
            return (
              <Pressable
                key={branch.id}
                accessibilityLabel={`Select ${branch.name} branch`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => setSelectedBranchId(branch.id)}
                style={({ pressed }) => [
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? colors.textOnPrimary : colors.text,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {branch.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  branchContainer: {
    flex: 1,
    gap: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
