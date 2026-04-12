import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export interface CustomerEditThemeColors {
  background: string;
  backgroundLight: string;
  border: string;
  card: string;
  primary: string;
  primaryLight: string;
  text: string;
  textMuted: string;
  textSecondary: string;
}

export interface CustomerEditShadows {
  md: StyleProp<ViewStyle>;
  sm: StyleProp<ViewStyle>;
}

export interface InputStyleOptions {
  input: StyleProp<ViewStyle>;
  label: StyleProp<TextStyle>;
  state: {
    backgroundColor: string;
    borderColor: string;
    color: string;
    shadowColor: string;
    shadowOpacity: number;
  };
}
