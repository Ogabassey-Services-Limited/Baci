
import { View } from 'react-native';
import { useMerchant } from '@/hooks/use-store';
import { vars } from 'nativewind';
import { ReactNode } from 'react';

/**
 * BrandThemeProvider
 * Fetches merchant brand colors and injects them as CSS variables for NativeWind.
 * Wraps the entire application.
 */
export function BrandThemeProvider({ children }: { children: ReactNode }) {
    const { data: merchant } = useMerchant();

    // Default theme (Ogabassey Red)
    const defaultColors = {
        '--primary': '#DC2626', // Red 600
        '--primary-foreground': '#FFFFFF',
        '--secondary': '#F59E0B', // Amber 500
        '--secondary-foreground': '#000000',
        '--accent': '#F59E0B',
        '--background': '#FFFFFF',
        '--foreground': '#111827',
    };

    // Merge merchant brand colors if available
    // Note: We need to handle potential hex-to-hsl conversion if we want to support opacity modifiers fully,
    // but for now we assume the DB provides valid color strings (hex or hsl).
    // NativeWind v4 vars() helper handles the injection.

    const theme = vars({
        '--primary': merchant?.brand_colors?.primary || defaultColors['--primary'],
        '--primary-foreground': defaultColors['--primary-foreground'], // Assuming white text for now
        '--secondary': merchant?.brand_colors?.accent || defaultColors['--secondary'],
        '--accent': merchant?.brand_colors?.accent || defaultColors['--accent'],
    });

    return (
        <View style={theme} className="flex-1">
            {children}
        </View>
    );
}
