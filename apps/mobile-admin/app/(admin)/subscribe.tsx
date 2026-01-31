import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import Paywall from '@/components/paywall/Paywall';
import { SPACING, TYPOGRAPHY } from '../../constants/theme';

export default function SubscribeScreen() {
  const { colors } = useTheme();
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

const styles = StyleSheet.create({
  closeButton: {
    padding: SPACING.xs,
  },
});
