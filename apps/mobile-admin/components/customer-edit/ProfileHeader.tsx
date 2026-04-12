import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { customerEditStyles as styles } from '@/components/customer-edit/customer-edit.styles';
import type { CustomerEditThemeColors } from '@/components/customer-edit/customer-edit.types';

interface ProfileHeaderProps {
  colors: CustomerEditThemeColors;
  email: string;
  initials: string;
  name: string;
}

export function ProfileHeader({
  colors,
  email,
  initials,
  name,
}: ProfileHeaderProps) {
  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.profileHeader}>
      <View
        style={[styles.avatarOuter, { backgroundColor: colors.primaryLight }]}
      >
        <View style={[styles.avatarInner, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>
      <Text style={[styles.headerName, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.headerSubtext, { color: colors.textSecondary }]}>
        {email}
      </Text>
    </Animated.View>
  );
}
