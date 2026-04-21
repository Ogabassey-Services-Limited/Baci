import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { styles } from './styles';

type CardSectionProps = {
  children: ReactNode;
  delay: number;
  title: string;
  titleColor: string;
};

export default function SettingsCardSection({
  children,
  delay,
  title,
  titleColor,
}: CardSectionProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}
