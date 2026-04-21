import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { CHANNELS } from './new-order.shared';
import { styles } from './new-order.styles';

interface NewOrderChannelSectionProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderChannelSection({
  controller,
}: NewOrderChannelSectionProps) {
  const { colors, selectedChannel, setSelectedChannel } = controller;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Sales Channel
      </Text>
      <ScrollView
        contentContainerStyle={styles.channelScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {CHANNELS.map((channel) => {
          const isSelected = selectedChannel === channel.id;
          const rawColor = channel.color || colors.primary;
          const activeColor = rawColor.startsWith('#')
            ? rawColor
            : colors[rawColor as keyof typeof colors] || colors.primary;

          return (
            <Pressable
              key={channel.id}
              accessibilityHint={`Switch order source to ${channel.label}`}
              accessibilityLabel={`${channel.label} channel`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedChannel(channel.id)}
              style={[
                styles.channelPill,
                {
                  backgroundColor: isSelected ? activeColor : colors.card,
                  borderColor: isSelected ? activeColor : colors.border,
                },
              ]}
            >
              <Ionicons
                color={isSelected ? colors.textOnPrimary : colors.textSecondary}
                name={channel.icon}
                size={18}
              />
              <Text
                style={[
                  styles.channelText,
                  { color: isSelected ? colors.textOnPrimary : colors.text },
                ]}
              >
                {channel.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
