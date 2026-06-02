import Ionicons from '@react-native-vector-icons/ionicons';
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

export function TabBarLabel({
  focused,
  label,
}: {
  focused: boolean;
  label: string;
}) {
  const { colors } = useTheme();

  // Test requirement: must return null when not focused to keep routing expectations clean
  if (!focused) return null;

  return (
    <Animated.Text
      entering={ZoomIn.duration(150)}
      exiting={ZoomOut.duration(100)}
      style={[styles.tabLabel, { color: colors.tabIconSelected }]}
    >
      {label}
    </Animated.Text>
  );
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
  
  // Spring scale shared value run strictly on C++ thread
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.18 : 1, {
      damping: 12,
      stiffness: 150,
    });
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.iconContainer}>
      <Animated.View
        style={[
          styles.iconInner,
          focused && { backgroundColor: 'transparent' }, // transparent overlay since CustomTabBar highlights it
          animatedStyle,
        ]}
      >
        <Ionicons
          name={name}
          size={22}
          color={focused ? colors.tabIconSelected : colors.tabIconDefault}
          style={{ opacity: focused ? 1 : 0.6 }}
        />
        {badge !== undefined && badge > 0 && (
          <Animated.View
            entering={ZoomIn.springify().damping(12)}
            exiting={ZoomOut}
            style={[
              styles.badge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.card,
              },
            ]}
          >
            <Animated.Text
              style={[styles.badgeText, { color: colors.primaryForeground }]}
            >
              {badge > 99 ? '99+' : badge}
            </Animated.Text>
          </Animated.View>
        )}
      </Animated.View>
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
