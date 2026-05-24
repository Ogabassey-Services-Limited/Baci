import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function DomainLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <Pressable
              onPress={() => router.back()}
              style={{ padding: SPACING.sm, marginLeft: -SPACING.sm }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ) : undefined,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: 'Domains',
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          headerTitle: 'Add a Domain',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="buy"
        options={{
          headerTitle: 'Search Domain',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="connect"
        options={{
          headerTitle: 'Connect Domain',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
