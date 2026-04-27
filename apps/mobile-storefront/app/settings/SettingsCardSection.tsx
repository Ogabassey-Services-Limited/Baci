import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { styles } from '@/components/settings/styles';

type SettingsCardSectionProps = {
  cardBackgroundColor: string;
  cardBorderColor: string;
  children: ReactNode;
  delay: number;
  title: string;
  titleColor: string;
};

export function SettingsCardSection({
  cardBackgroundColor,
  cardBorderColor,
  children,
  delay,
  title,
  titleColor,
}: SettingsCardSectionProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBackgroundColor,
            borderColor: cardBorderColor,
          },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}
