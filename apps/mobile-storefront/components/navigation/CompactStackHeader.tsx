import { Ionicons } from '@expo/vector-icons';
import type {
  NativeStackHeaderBackProps,
  NativeStackHeaderItemProps,
  NativeStackHeaderProps,
} from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

function resolveHeaderTitle({
  options,
  routeName,
}: {
  options: NativeStackHeaderProps['options'];
  routeName: string;
}) {
  if (typeof options.headerTitle === 'string') {
    return options.headerTitle;
  }

  if (typeof options.title === 'string') {
    return options.title;
  }

  return routeName;
}

export function CompactStackHeader({
  back,
  navigation,
  options,
  route,
}: NativeStackHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const canGoBack = Boolean(back);
  const tintColor = options.headerTintColor ?? colors.text;
  const headerStyle = StyleSheet.flatten(options.headerStyle) ?? {};
  const backgroundColor = headerStyle.backgroundColor ?? colors.background;
  const title = resolveHeaderTitle({ options, routeName: route.name });

  const leftProps: NativeStackHeaderBackProps = {
    canGoBack,
    tintColor,
    label: back?.title,
    href: back?.href,
  };

  const rightProps: NativeStackHeaderItemProps = {
    canGoBack,
    tintColor,
  };

  const leftContent = options.headerLeft?.(leftProps);
  const rightContent = options.headerRight?.(rightProps);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderBottomColor: colors.border,
          paddingTop: Math.max(insets.top - 8, 6),
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.side}>
          {leftContent ??
            (canGoBack ? (
              <Pressable
                onPress={() => navigation.goBack()}
                style={[styles.backButton, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={18} color={tintColor} />
                <Text style={[styles.backLabel, { color: tintColor }]}>
                  Back
                </Text>
              </Pressable>
            ) : null)}
        </View>

        <View style={styles.titleWrap}>
          {title ? (
            <Text
              style={[styles.title, { color: tintColor }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </View>

        <View style={[styles.side, styles.sideRight]}>{rightContent}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  side: {
    minWidth: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  backButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
