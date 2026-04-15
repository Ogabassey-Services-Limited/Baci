import {
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { AppDialogModal } from '@/components/ui/AppDialogModal';
import type { ThemeColors } from '@/constants/theme';
import { blogEditorStyles } from './blog-editor.styles';

interface BlogEditorDialogCardProps {
  cancelAccessibilityLabel: string;
  colors: ThemeColors;
  confirmAccessibilityLabel: string;
  confirmButtonColor: string;
  confirmLabel: string;
  confirmTextColor: string;
  dialogLabel: string;
  inputAccessibilityLabel: string;
  inputProps?: Omit<
    TextInputProps,
    | 'accessibilityLabel'
    | 'onChangeText'
    | 'onSubmitEditing'
    | 'placeholder'
    | 'placeholderTextColor'
    | 'style'
    | 'value'
  >;
  onCancel: () => void;
  onChangeText: (value: string) => void;
  onConfirm: () => void;
  placeholder: string;
  subtitle: string;
  title: string;
  value: string;
  visible: boolean;
}

export function BlogEditorDialogCard({
  cancelAccessibilityLabel,
  colors,
  confirmAccessibilityLabel,
  confirmButtonColor,
  confirmLabel,
  confirmTextColor,
  dialogLabel,
  inputAccessibilityLabel,
  inputProps,
  onCancel,
  onChangeText,
  onConfirm,
  placeholder,
  subtitle,
  title,
  value,
  visible,
}: BlogEditorDialogCardProps) {
  return (
    <AppDialogModal keyboardAware onClose={onCancel} visible={visible}>
      <View
        accessibilityLabel={dialogLabel}
        accessibilityViewIsModal={true}
        accessible={true}
        style={[blogEditorStyles.dialogCard, { backgroundColor: colors.card }]}
      >
        <Text style={[blogEditorStyles.dialogTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text
          style={[
            blogEditorStyles.dialogSubtitle,
            { color: colors.textSecondary },
          ]}
        >
          {subtitle}
        </Text>

        <TextInput
          accessibilityLabel={inputAccessibilityLabel}
          onChangeText={onChangeText}
          onSubmitEditing={onConfirm}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={[
            blogEditorStyles.dialogInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={value}
          {...inputProps}
        />

        <View style={blogEditorStyles.dialogActions}>
          <Pressable
            accessibilityLabel={cancelAccessibilityLabel}
            accessibilityRole="button"
            onPress={onCancel}
            style={[
              blogEditorStyles.dialogButton,
              { backgroundColor: colors.border },
            ]}
          >
            <Text
              style={[
                blogEditorStyles.dialogButtonText,
                { color: colors.text },
              ]}
            >
              Cancel
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={confirmAccessibilityLabel}
            accessibilityRole="button"
            onPress={onConfirm}
            style={[
              blogEditorStyles.dialogButton,
              { backgroundColor: confirmButtonColor },
            ]}
          >
            <Text
              style={[
                blogEditorStyles.dialogButtonText,
                { color: confirmTextColor },
              ]}
            >
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppDialogModal>
  );
}
