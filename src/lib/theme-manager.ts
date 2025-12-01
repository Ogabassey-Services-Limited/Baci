import { ThemeConfiguration } from './theme-config';

/**
 * Theme Manager
 * 
 * Applies theme configuration to CSS custom properties at runtime.
 * This allows all components to automatically use the theme values.
 */

/**
 * Apply a theme configuration to the document root
 * This sets CSS custom properties that components can reference
 */
export function applyTheme(theme: ThemeConfiguration): void {
    const root = document.documentElement;

    // ===== COLORS =====
    // Base colors
    root.style.setProperty('--theme-primary', theme.colors.primary);
    root.style.setProperty('--theme-secondary', theme.colors.secondary);
    root.style.setProperty('--theme-accent', theme.colors.accent);
    root.style.setProperty('--theme-background', theme.colors.background);
    root.style.setProperty('--theme-foreground', theme.colors.foreground);
    root.style.setProperty('--theme-muted', theme.colors.muted);
    root.style.setProperty('--theme-muted-foreground', theme.colors.mutedForeground);
    root.style.setProperty('--theme-border', theme.colors.border);

    // Header colors
    root.style.setProperty('--theme-header-bg', theme.colors.header.background);
    root.style.setProperty('--theme-header-text', theme.colors.header.text);
    root.style.setProperty('--theme-header-icon', theme.colors.header.iconColor);

    root.style.setProperty('--theme-header-search-border', theme.colors.header.searchBorder);
    root.style.setProperty('--theme-header-search-bg', theme.colors.header.searchBackground);

    // Footer colors
    root.style.setProperty('--theme-footer-bg', theme.colors.footer.background);
    root.style.setProperty('--theme-footer-text', theme.colors.footer.text);
    root.style.setProperty('--theme-footer-link', theme.colors.footer.linkColor);
    root.style.setProperty('--theme-footer-link-hover', theme.colors.footer.linkHoverColor);

    // Button colors
    root.style.setProperty('--theme-button-primary-bg', theme.colors.button.primary.background);
    root.style.setProperty('--theme-button-primary-text', theme.colors.button.primary.text);
    root.style.setProperty('--theme-button-primary-hover', theme.colors.button.primary.hover);

    root.style.setProperty('--theme-button-secondary-bg', theme.colors.button.secondary.background);
    root.style.setProperty('--theme-button-secondary-text', theme.colors.button.secondary.text);
    root.style.setProperty('--theme-button-secondary-hover', theme.colors.button.secondary.hover);

    root.style.setProperty('--theme-button-accent-bg', theme.colors.button.accent.background);
    root.style.setProperty('--theme-button-accent-text', theme.colors.button.accent.text);
    root.style.setProperty('--theme-button-accent-hover', theme.colors.button.accent.hover);

    // Card colors
    root.style.setProperty('--theme-card-bg', theme.colors.card.background);
    root.style.setProperty('--theme-card-border', theme.colors.card.border);
    root.style.setProperty('--theme-card-text', theme.colors.card.text);

    // Input colors
    root.style.setProperty('--theme-input-bg', theme.colors.input.background);
    root.style.setProperty('--theme-input-border', theme.colors.input.border);
    root.style.setProperty('--theme-input-text', theme.colors.input.text);
    root.style.setProperty('--theme-input-placeholder', theme.colors.input.placeholder);
    root.style.setProperty('--theme-input-focus-border', theme.colors.input.focusBorder);

    // ===== TYPOGRAPHY =====
    // Font families
    root.style.setProperty('--theme-font-heading', theme.typography.fontFamily.heading);
    root.style.setProperty('--theme-font-body', theme.typography.fontFamily.body);
    root.style.setProperty('--theme-font-mono', theme.typography.fontFamily.mono);

    // Font sizes
    root.style.setProperty('--theme-text-xs', theme.typography.fontSize.xs);
    root.style.setProperty('--theme-text-sm', theme.typography.fontSize.sm);
    root.style.setProperty('--theme-text-base', theme.typography.fontSize.base);
    root.style.setProperty('--theme-text-lg', theme.typography.fontSize.lg);
    root.style.setProperty('--theme-text-xl', theme.typography.fontSize.xl);
    root.style.setProperty('--theme-text-2xl', theme.typography.fontSize['2xl']);
    root.style.setProperty('--theme-text-3xl', theme.typography.fontSize['3xl']);
    root.style.setProperty('--theme-text-4xl', theme.typography.fontSize['4xl']);
    root.style.setProperty('--theme-text-5xl', theme.typography.fontSize['5xl']);
    root.style.setProperty('--theme-text-6xl', theme.typography.fontSize['6xl']);

    // Font weights
    root.style.setProperty('--theme-font-light', theme.typography.fontWeight.light.toString());
    root.style.setProperty('--theme-font-normal', theme.typography.fontWeight.normal.toString());
    root.style.setProperty('--theme-font-medium', theme.typography.fontWeight.medium.toString());
    root.style.setProperty('--theme-font-semibold', theme.typography.fontWeight.semibold.toString());
    root.style.setProperty('--theme-font-bold', theme.typography.fontWeight.bold.toString());
    root.style.setProperty('--theme-font-extrabold', theme.typography.fontWeight.extrabold.toString());

    // Line heights
    root.style.setProperty('--theme-leading-tight', theme.typography.lineHeight.tight.toString());
    root.style.setProperty('--theme-leading-normal', theme.typography.lineHeight.normal.toString());
    root.style.setProperty('--theme-leading-relaxed', theme.typography.lineHeight.relaxed.toString());
    root.style.setProperty('--theme-leading-loose', theme.typography.lineHeight.loose.toString());

    // Letter spacing
    root.style.setProperty('--theme-tracking-tight', theme.typography.letterSpacing.tight);
    root.style.setProperty('--theme-tracking-normal', theme.typography.letterSpacing.normal);
    root.style.setProperty('--theme-tracking-wide', theme.typography.letterSpacing.wide);

    // ===== SPACING =====
    // Global spacing
    root.style.setProperty('--theme-space-xs', theme.spacing.xs);
    root.style.setProperty('--theme-space-sm', theme.spacing.sm);
    root.style.setProperty('--theme-space-md', theme.spacing.md);
    root.style.setProperty('--theme-space-lg', theme.spacing.lg);
    root.style.setProperty('--theme-space-xl', theme.spacing.xl);
    root.style.setProperty('--theme-space-2xl', theme.spacing['2xl']);
    root.style.setProperty('--theme-space-3xl', theme.spacing['3xl']);

    // Component spacing
    root.style.setProperty('--theme-header-height', theme.spacing.header.height);
    root.style.setProperty('--theme-header-px', theme.spacing.header.paddingX);
    root.style.setProperty('--theme-header-py', theme.spacing.header.paddingY);

    root.style.setProperty('--theme-footer-py', theme.spacing.footer.paddingY);
    root.style.setProperty('--theme-footer-px', theme.spacing.footer.paddingX);

    root.style.setProperty('--theme-section-py', theme.spacing.section.paddingY);
    root.style.setProperty('--theme-section-px', theme.spacing.section.paddingX);

    root.style.setProperty('--theme-container-max-width', theme.spacing.container.maxWidth);
    root.style.setProperty('--theme-container-px', theme.spacing.container.paddingX);

    // ===== BORDERS & RADIUS =====
    // Border widths
    root.style.setProperty('--theme-border-none', theme.borders.width.none);
    root.style.setProperty('--theme-border-thin', theme.borders.width.thin);
    root.style.setProperty('--theme-border-normal', theme.borders.width.normal);
    root.style.setProperty('--theme-border-thick', theme.borders.width.thick);

    // Border radius
    root.style.setProperty('--theme-radius-none', theme.borders.radius.none);
    root.style.setProperty('--theme-radius-sm', theme.borders.radius.sm);
    root.style.setProperty('--theme-radius-md', theme.borders.radius.md);
    root.style.setProperty('--theme-radius-lg', theme.borders.radius.lg);
    root.style.setProperty('--theme-radius-xl', theme.borders.radius.xl);
    root.style.setProperty('--theme-radius-2xl', theme.borders.radius['2xl']);
    root.style.setProperty('--theme-radius-full', theme.borders.radius.full);

    // ===== SHADOWS =====
    root.style.setProperty('--theme-shadow-none', theme.shadows.none);
    root.style.setProperty('--theme-shadow-sm', theme.shadows.sm);
    root.style.setProperty('--theme-shadow-md', theme.shadows.md);
    root.style.setProperty('--theme-shadow-lg', theme.shadows.lg);
    root.style.setProperty('--theme-shadow-xl', theme.shadows.xl);
    root.style.setProperty('--theme-shadow-2xl', theme.shadows['2xl']);
    root.style.setProperty('--theme-shadow-inner', theme.shadows.inner);

    // ===== ANIMATIONS =====
    root.style.setProperty('--theme-duration-fast', theme.animations.duration.fast);
    root.style.setProperty('--theme-duration-normal', theme.animations.duration.normal);
    root.style.setProperty('--theme-duration-slow', theme.animations.duration.slow);

    root.style.setProperty('--theme-easing-linear', theme.animations.easing.linear);
    root.style.setProperty('--theme-easing-in', theme.animations.easing.easeIn);
    root.style.setProperty('--theme-easing-out', theme.animations.easing.easeOut);
    root.style.setProperty('--theme-easing-in-out', theme.animations.easing.easeInOut);

    // ===== LAYOUT =====
    // Z-index values
    root.style.setProperty('--theme-z-dropdown', theme.layout.zIndex.dropdown.toString());
    root.style.setProperty('--theme-z-sticky', theme.layout.zIndex.sticky.toString());
    root.style.setProperty('--theme-z-fixed', theme.layout.zIndex.fixed.toString());
    root.style.setProperty('--theme-z-modal-backdrop', theme.layout.zIndex.modalBackdrop.toString());
    root.style.setProperty('--theme-z-modal', theme.layout.zIndex.modal.toString());
    root.style.setProperty('--theme-z-popover', theme.layout.zIndex.popover.toString());
    root.style.setProperty('--theme-z-tooltip', theme.layout.zIndex.tooltip.toString());
}

/**
 * Get the current theme from CSS custom properties
 * Useful for reading the active theme
 */
export function getCurrentTheme(): Partial<ThemeConfiguration> {
    const root = document.documentElement;
    const style = getComputedStyle(root);

    // This is a simplified version - in practice, you'd read all properties
    return {
        colors: {
            primary: style.getPropertyValue('--theme-primary').trim(),
            header: {
                background: style.getPropertyValue('--theme-header-bg').trim(),
            },
        },
    } as Partial<ThemeConfiguration>;
}

/**
 * Merge a partial theme configuration with the current theme
 * Useful for updating only specific theme properties
 */
export function validateTheme(theme: ThemeConfiguration): boolean {
    // Basic validation
    if (!theme.colors || !theme.typography) {
        return false;
    }
    return true;
}
