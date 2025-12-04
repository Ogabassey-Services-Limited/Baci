'use client';

import { useEffect } from 'react';
import { useMerchant } from '@/hooks/use-merchant';

function hexToHsl(hex: string): string {
    // Remove hash if present
    hex = hex.replace(/^#/, '');

    // Handle shorthand hex
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((char) => char + char)
            .join('');
    }

    // Parse r, g, b
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Convert to fraction
    r /= 255;
    g /= 255;
    b /= 255;

    // Find min and max
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    // Convert to degrees and percentages
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
}

export function CheckoutThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { merchant } = useMerchant();

    useEffect(() => {
        if (merchant?.brand_colors?.primary) {
            const root = document.documentElement;
            const primaryHex = merchant.brand_colors.primary;
            const primaryHsl = hexToHsl(primaryHex);

            // Set Tailwind CSS variable (HSL)
            root.style.setProperty('--primary', primaryHsl);

            // Set Theme variable (Hex) - for components using --theme-primary
            root.style.setProperty('--theme-primary', primaryHex);

            // Set Store variables - for ThemedButton
            root.style.setProperty('--store-primary', primaryHex);

            // Calculate contrast text color
            // Simple logic: if L > 0.5 use black, else white
            const l = parseInt(primaryHsl.split(' ')[2]);
            const textColor = l > 60 ? '#000000' : '#FFFFFF';
            root.style.setProperty('--store-primary-text', textColor);
        }
    }, [merchant]);

    return <>{children}</>;
}
