import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import RenderHTML, { MixedStyleDeclaration } from 'react-native-render-html';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface HTMLRendererProps {
  html: string;
  baseColor?: string;
}

/**
 * Reusable HTML Renderer for Mobile
 * Handles semantic HTML from web/CMS and maps it to React Native components.
 * 2026 Best Practice: Avoids 'div' soup by utilizing specialized renderers.
 */
export const HTMLRenderer = ({ html, baseColor }: HTMLRendererProps) => {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const tagsStyles = useMemo<Record<string, MixedStyleDeclaration>>(
    () => ({
      body: {
        color: baseColor || colors.text,
        fontSize: 15,
        lineHeight: 24,
        fontFamily: 'serif', // System serif matches web's premium feel
      },
      p: {
        marginBottom: 16,
      },
      h1: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 16,
        color: colors.text,
      },
      h2: {
        fontSize: 20,
        fontWeight: '700' as MixedStyleDeclaration['fontWeight'],
        marginTop: 24,
        marginBottom: 12,
        color: colors.text,
      },
      h3: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
        color: colors.text,
      },
      strong: {
        fontWeight: '700' as MixedStyleDeclaration['fontWeight'],
        color: colors.text,
      },
      ul: {
        marginBottom: 16,
        paddingLeft: 20,
      },
      ol: {
        marginBottom: 16,
        paddingLeft: 20,
      },
      li: {
        marginBottom: 8,
      },
      em: {
        fontStyle: 'italic',
      },
      a: {
        color: colors.primary,
        textDecorationLine: 'underline',
      },
    }),
    [colors, baseColor]
  );

  if (!html) return null;

  return (
    <RenderHTML
      contentWidth={width - 40} // Accounting for default screen padding
      source={{ html }}
      tagsStyles={tagsStyles}
      enableExperimentalMarginCollapsing={true}
    />
  );
};
