import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface SettingsListItemProps {
  icon: IoniconsIconName;
  title: string;
  subtitle?: string;
  showArrow?: boolean;
  toggle?: boolean;
  onPress?: () => void;
}

export default function SettingsListItem({
  icon,
  title,
  subtitle,
  showArrow = true,
  toggle,
  onPress,
}: SettingsListItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingItem,
        { borderBottomColor: colors.border },
        pressed && onPress && { opacity: 0.7 },
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={onPress ? subtitle : undefined}
    >
      <View
        style={[styles.settingIcon, { backgroundColor: colors.background }]}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.settingSubtitle, { color: colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          onValueChange={() => {
            // Toggle logic is handled by the parent settings screen.
          }}
          trackColor={{ true: colors.primary }}
        />
      ) : showArrow ? (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
