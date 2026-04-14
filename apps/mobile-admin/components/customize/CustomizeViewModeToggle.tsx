import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { customizeStyles } from './customize.styles';

interface CustomizeViewModeToggleProps {
  colors: ThemeColors;
  onChange: (value: 'chat' | 'preview') => void;
  value: 'chat' | 'preview';
}

export function CustomizeViewModeToggle({
  colors,
  onChange,
  value,
}: CustomizeViewModeToggleProps) {
  const activeTextColor = colors.textOnPrimary ?? '#FFFFFF';

  return (
    <View
      style={[
        customizeStyles.toggleContainer,
        { backgroundColor: colors.card },
      ]}
    >
      <Pressable
        accessibilityHint="Switch to the chat editor view"
        accessibilityLabel="Chat view mode"
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'chat' }}
        onPress={() => onChange('chat')}
        style={[
          customizeStyles.toggleButton,
          value === 'chat' && [
            customizeStyles.toggleActive,
            { backgroundColor: colors.primary },
          ],
        ]}
      >
        <Ionicons
          color={value === 'chat' ? activeTextColor : colors.textSecondary}
          name="chatbubbles"
          size={18}
        />
        <Text
          style={[
            customizeStyles.toggleText,
            {
              color: value === 'chat' ? activeTextColor : colors.textSecondary,
            },
          ]}
        >
          Chat
        </Text>
      </Pressable>
      <Pressable
        accessibilityHint="Switch to the storefront preview"
        accessibilityLabel="Preview view mode"
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'preview' }}
        onPress={() => onChange('preview')}
        style={[
          customizeStyles.toggleButton,
          value === 'preview' && [
            customizeStyles.toggleActive,
            { backgroundColor: colors.primary },
          ],
        ]}
      >
        <Ionicons
          color={value === 'preview' ? activeTextColor : colors.textSecondary}
          name="eye"
          size={18}
        />
        <Text
          style={[
            customizeStyles.toggleText,
            {
              color:
                value === 'preview' ? activeTextColor : colors.textSecondary,
            },
          ]}
        >
          Preview
        </Text>
      </Pressable>
    </View>
  );
}
