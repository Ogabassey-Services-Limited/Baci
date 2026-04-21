type ThemePalette = typeof import('@/constants/Colors').default;

export type ThemeColors = Pick<
  ThemePalette['light'],
  'background' | 'border' | 'card' | 'text' | 'textSecondary'
>;
