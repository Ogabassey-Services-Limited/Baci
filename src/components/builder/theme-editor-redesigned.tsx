'use client';

import { useState } from 'react';
import { ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeEditorProps {
    theme: ThemeConfiguration;
    onChange: (theme: ThemeConfiguration) => void;
    onReset: () => void;
}

/**
 * Redesigned Theme Editor - Modern, Visual Interface
 * Inspired by professional website builders
 */
export function ThemeEditor({ theme, onChange, onReset }: ThemeEditorProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['colors', 'borders', 'spacing', 'shadows']));

    const toggleSection = (section: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(section)) {
            newExpanded.delete(section);
        } else {
            newExpanded.add(section);
        }
        setExpandedSections(newExpanded);
    };

    const updateColor = (path: string[], value: string) => {
        // Prevent prototype pollution by blocking dangerous property names
        const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
        if (path.some(key => dangerousKeys.has(key))) {
            console.warn('Blocked attempt to access dangerous property in theme path');
            return;
        }

        // Use a safe deep clone that creates null-prototype objects to prevent prototype pollution
        const safeDeepClone = (obj: Record<string, unknown>): Record<string, unknown> => {
            const result = Object.create(null) as Record<string, unknown>;
            for (const key of Object.keys(obj)) {
                const val = obj[key];
                if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                    result[key] = safeDeepClone(val as Record<string, unknown>);
                } else {
                    result[key] = val;
                }
            }
            return result;
        };

        // Create a safe working copy with null prototypes
        const safeCopy = safeDeepClone(theme as unknown as Record<string, unknown>);
        let current: Record<string, unknown> = safeCopy;

        // Traverse to the parent object, validating each step
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            // Ensure we're only accessing own properties (Object.keys only returns own props)
            if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
                console.warn(`Invalid theme path: property "${key}" does not exist or is not an object`);
                return;
            }
            current = current[key] as Record<string, unknown>;
        }

        // Set the final property value
        const finalKey = path[path.length - 1];
        if (finalKey in current) {
            current[finalKey] = value;
            // Convert back to regular object for the theme system
            const newTheme = JSON.parse(JSON.stringify(safeCopy)) as ThemeConfiguration;
            onChange(newTheme);
            applyTheme(newTheme);
        } else {
            console.warn(`Invalid theme path: property "${finalKey}" does not exist`);
        }
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold">Theme Settings</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onReset}
                        className="h-8 gap-1.5 text-xs"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">Customize your site's appearance</p>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto">
                {/* COLORS */}
                <Section
                    title="Colors"
                    isExpanded={expandedSections.has('colors')}
                    onToggle={() => toggleSection('colors')}
                >
                    <div className="space-y-4">
                        {/* Brand Colors */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <ColorSwatch
                                    label="Primary"
                                    value={theme.colors.primary}
                                    onChange={(v) => updateColor(['colors', 'primary'], v)}
                                />
                                <ColorSwatch
                                    label="Accent"
                                    value={theme.colors.accent}
                                    onChange={(v) => updateColor(['colors', 'accent'], v)}
                                />
                            </div>
                        </div>

                        {/* Header Colors */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Header</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <ColorSwatch
                                    label="Background"
                                    value={theme.colors.header.background}
                                    onChange={(v) => updateColor(['colors', 'header', 'background'], v)}
                                />
                                <ColorSwatch
                                    label="Text"
                                    value={theme.colors.header.text}
                                    onChange={(v) => updateColor(['colors', 'header', 'text'], v)}
                                />
                                <ColorSwatch
                                    label="Cart Icon"
                                    value={theme.colors.header.cartIconColor}
                                    onChange={(v) => updateColor(['colors', 'header', 'cartIconColor'], v)}
                                />
                                <ColorSwatch
                                    label="Search"
                                    value={theme.colors.header.searchBorder}
                                    onChange={(v) => updateColor(['colors', 'header', 'searchBorder'], v)}
                                />
                            </div>
                        </div>

                        {/* Footer Colors */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Footer</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <ColorSwatch
                                    label="Background"
                                    value={theme.colors.footer.background}
                                    onChange={(v) => updateColor(['colors', 'footer', 'background'], v)}
                                />
                                <ColorSwatch
                                    label="Text"
                                    value={theme.colors.footer.text}
                                    onChange={(v) => updateColor(['colors', 'footer', 'text'], v)}
                                />
                                <ColorSwatch
                                    label="Links"
                                    value={theme.colors.footer.linkColor}
                                    onChange={(v) => updateColor(['colors', 'footer', 'linkColor'], v)}
                                />
                            </div>
                        </div>

                        {/* Button Colors */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buttons</h4>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1.5">Primary</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <ColorSwatch
                                            label="BG"
                                            value={theme.colors.button.primary.background}
                                            onChange={(v) => updateColor(['colors', 'button', 'primary', 'background'], v)}
                                            compact
                                        />
                                        <ColorSwatch
                                            label="Text"
                                            value={theme.colors.button.primary.text}
                                            onChange={(v) => updateColor(['colors', 'button', 'primary', 'text'], v)}
                                            compact
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* TYPOGRAPHY */}
                <Section
                    title="Typography"
                    isExpanded={expandedSections.has('typography')}
                    onToggle={() => toggleSection('typography')}
                >
                    <div className="space-y-3">
                        <TextInput
                            label="Heading Font"
                            value={theme.typography.fontFamily.heading}
                            onChange={(v) => updateColor(['typography', 'fontFamily', 'heading'], v)}
                            placeholder="Inter, sans-serif"
                        />
                        <TextInput
                            label="Body Font"
                            value={theme.typography.fontFamily.body}
                            onChange={(v) => updateColor(['typography', 'fontFamily', 'body'], v)}
                            placeholder="Inter, sans-serif"
                        />

                        <div className="pt-2 border-t">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Sizes</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <TextInput
                                    label="Base"
                                    value={theme.typography.fontSize.base}
                                    onChange={(v) => updateColor(['typography', 'fontSize', 'base'], v)}
                                    placeholder="1rem"
                                    compact
                                />
                                <TextInput
                                    label="Large"
                                    value={theme.typography.fontSize.lg}
                                    onChange={(v) => updateColor(['typography', 'fontSize', 'lg'], v)}
                                    placeholder="1.125rem"
                                    compact
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* SPACING */}
                <Section
                    title="Spacing"
                    isExpanded={expandedSections.has('spacing')}
                    onToggle={() => toggleSection('spacing')}
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Global Scale</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <TextInput
                                    label="Base (MD)"
                                    value={theme.spacing.md}
                                    onChange={(v) => updateColor(['spacing', 'md'], v)}
                                    placeholder="1rem"
                                    compact
                                />
                                <TextInput
                                    label="Large (LG)"
                                    value={theme.spacing.lg}
                                    onChange={(v) => updateColor(['spacing', 'lg'], v)}
                                    placeholder="1.5rem"
                                    compact
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Header</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <TextInput
                                    label="Height"
                                    value={theme.spacing.header.height}
                                    onChange={(v) => updateColor(['spacing', 'header', 'height'], v)}
                                    placeholder="4rem"
                                    compact
                                />
                                <TextInput
                                    label="Padding"
                                    value={theme.spacing.header.paddingX}
                                    onChange={(v) => updateColor(['spacing', 'header', 'paddingX'], v)}
                                    placeholder="1rem"
                                    compact
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* BORDERS */}
                <Section
                    title="Borders & Radius"
                    isExpanded={expandedSections.has('borders')}
                    onToggle={() => toggleSection('borders')}
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Corner Radius</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <TextInput
                                    label="Small"
                                    value={theme.borders.radius.sm}
                                    onChange={(v) => updateColor(['borders', 'radius', 'sm'], v)}
                                    placeholder="0.25rem"
                                    compact
                                />
                                <TextInput
                                    label="Medium"
                                    value={theme.borders.radius.md}
                                    onChange={(v) => updateColor(['borders', 'radius', 'md'], v)}
                                    placeholder="0.5rem"
                                    compact
                                />
                                <TextInput
                                    label="Large"
                                    value={theme.borders.radius.lg}
                                    onChange={(v) => updateColor(['borders', 'radius', 'lg'], v)}
                                    placeholder="0.75rem"
                                    compact
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <TextInput
                                    label="Full (Pill)"
                                    value={theme.borders.radius.full}
                                    onChange={(v) => updateColor(['borders', 'radius', 'full'], v)}
                                    placeholder="9999px"
                                    compact
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* SHADOWS */}
                <Section
                    title="Shadows"
                    isExpanded={expandedSections.has('shadows')}
                    onToggle={() => toggleSection('shadows')}
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Elevation</h4>
                            <div className="space-y-2">
                                <TextInput
                                    label="Small"
                                    value={theme.shadows.sm}
                                    onChange={(v) => updateColor(['shadows', 'sm'], v)}
                                    placeholder="0 1px 2px 0 rgb(0 0 0 / 0.05)"
                                    compact
                                />
                                <TextInput
                                    label="Medium"
                                    value={theme.shadows.md}
                                    onChange={(v) => updateColor(['shadows', 'md'], v)}
                                    placeholder="0 4px 6px -1px..."
                                    compact
                                />
                            </div>
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}

// Section Component
function Section({
    title,
    isExpanded,
    onToggle,
    children
}: {
    title: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="border-b">
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
                <span className="text-sm font-medium">{title}</span>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
            </button>
            {isExpanded && (
                <div className="px-4 pb-4">
                    {children}
                </div>
            )}
        </div>
    );
}

// Color Swatch Component
function ColorSwatch({
    label,
    value,
    onChange,
    compact = false
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    compact?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <div className="flex gap-2">
                <div className="relative">
                    <input
                        type="color"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                        style={{ padding: '2px' }}
                    />
                </div>
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        "font-mono uppercase",
                        compact ? "h-10 text-xs" : "h-10 text-sm"
                    )}
                    placeholder="#000000"
                />
            </div>
        </div>
    );
}

// Text Input Component
function TextInput({
    label,
    value,
    onChange,
    placeholder,
    compact = false
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    compact?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={compact ? "h-9 text-xs" : "h-10 text-sm"}
                placeholder={placeholder}
            />
        </div>
    );
}
