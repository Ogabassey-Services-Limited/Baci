import { Stack } from 'expo-router';
import { CompactStackHeader } from '@/components/navigation/CompactStackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function UtilitiesLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Stack
      screenOptions={{
        header: (props) => <CompactStackHeader {...props} />,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="[type]"
        options={{
          title: 'Purchase Utility',
        }}
      />
    </Stack>
  );
}
