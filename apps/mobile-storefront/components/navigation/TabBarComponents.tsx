import Ionicons from '@react-native-vector-icons/ionicons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function TabBarLabel({ focused, label }: { focused: boolean; label: string }) {
  const { colors } = useTheme();
  if (!focused) return null;
  return <Text style={[styles.tabLabel, { color: colors.text }]}>{label}</Text>;
}

export function TabBarIcon({
  name,
  focused,
  badge,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
  badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.iconContainer}>
      <View
        style={[
          styles.iconInner,
          focused && { backgroundColor: colors.selectedIconBackground },
        ]}
      >
        <Ionicons
          name={name}
          size={22}
          color={focused ? colors.text : colors.tabIconDefault}
          style={{ opacity: focused ? 1 : 0.6 }}
        />
        {badge !== undefined && badge > 0 && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.card,
              },
            ]}
          >
            <Text
              style={[styles.badgeText, { color: colors.primaryForeground }]}
            >
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  iconContainer: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 4,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
});
