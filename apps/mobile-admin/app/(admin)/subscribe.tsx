import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import Paywall from '@/components/paywall/Paywall';
import { SPACING } from '../../constants/theme';

export default function SubscribeScreen() {
  const { colors: _colors } = useTheme();
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <Paywall onClose={() => router.back()} />
    </>
  );
}

const _styles = StyleSheet.create({
  closeButton: {
    padding: SPACING.xs,
  },
});
