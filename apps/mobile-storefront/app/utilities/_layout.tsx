import { Stack } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function UtilitiesLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.muted,
        },
      }}
    >
      <Stack.Screen name="[type]" />
      <Stack.Screen
        name="history"
        options={{
          headerBackButtonDisplayMode: 'minimal',
          headerBackTitle: '',
          headerShown: true,
          title: 'Utility History',
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      />
    </Stack>
  );
}
