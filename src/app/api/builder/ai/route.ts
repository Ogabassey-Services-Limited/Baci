import { geminiFlash } from '@/ai/provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// Component Prop Schemas
const HeroPropsSchema = z.object({
    title: z.string(),
    subtitle: z.string(),
    ctaText: z.string(),
    ctaLink: z.string(),
    align: z.enum(['left', 'center', 'right']),
    padding: z.enum(['small', 'medium', 'large']),
});

const HeroCarouselPropsSchema = z.object({
    slides: z.array(z.object({
        image: z.string(),
        title: z.string(),
        subtitle: z.string(),
        ctaText: z.string(),
        ctaLink: z.string()
    }))
});

const TextPropsSchema = z.object({
    title: z.string().optional(),
    content: z.string(),
    align: z.enum(['left', 'center', 'right']),
});

const ImagePropsSchema = z.object({
    src: z.string(),
    alt: z.string(),
    aspectRatio: z.enum(['auto', '16/9', '4/3', '1/1']),
});

const ButtonPropsSchema = z.object({
    text: z.string(),
    link: z.string(),
    variant: z.enum(['primary', 'background', 'accent']),
    align: z.enum(['left', 'center', 'right']),
});

const ProductGridPropsSchema = z.object({
    title: z.string(),
    columns: z.number().min(1).max(4),
    limit: z.number().min(1).max(12),
});

const TestimonialPropsSchema = z.object({
    quote: z.string(),
    author: z.string(),
    role: z.string(),
});

const FeaturesPropsSchema = z.object({
    title: z.string(),
    features: z.array(z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string().optional()
    })),
});

const NewsletterPropsSchema = z.object({
    title: z.string(),
    description: z.string(),
    buttonText: z.string(),
});

const SpacerPropsSchema = z.object({
    height: z.enum(['small', 'medium', 'large']),
});

const HeaderPropsSchema = z.object({}).passthrough();

const FooterPropsSchema = z.object({}).passthrough();

// Theme Configuration Schema (subset of most commonly modified properties)
const ThemeColorsSchema = z.object({
    primary: z.string().optional(),
    accent: z.string().optional(),
    header: z.object({
        background: z.string().optional(),
        text: z.string().optional(),
        iconColor: z.string().optional(),
        cartIconColor: z.string().optional(),
        searchBorder: z.string().optional(),
        searchBackground: z.string().optional(),
    }).optional(),
    footer: z.object({
        background: z.string().optional(),
        text: z.string().optional(),
        linkColor: z.string().optional(),
        linkHoverColor: z.string().optional(),
    }).optional(),
}).passthrough();

const ThemeSchema = z.object({
    colors: ThemeColorsSchema.optional(),
}).passthrough();

// Main Puck Data Schema
const puckDataSchema = z.object({
    content: z.array(z.object({
        type: z.string(),
        props: z.union([
            HeroPropsSchema,
            HeroCarouselPropsSchema,
            TextPropsSchema,
            ImagePropsSchema,
            ButtonPropsSchema,
            ProductGridPropsSchema,
            TestimonialPropsSchema,
            FeaturesPropsSchema,
            NewsletterPropsSchema,
            SpacerPropsSchema,
            HeaderPropsSchema,
            z.any() // Fallback for Footer and unknown props
        ]),
    })),
    root: z.object({
        title: z.string().optional(),
    }).passthrough(),
    zones: z.any().optional(),
    theme: ThemeSchema.optional(), // Add theme to the schema
}).passthrough();

export async function POST(req: Request) {
    try {
        const { prompt, currentConfig } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const systemPrompt = `
      You are an expert website builder assistant. 
      You are given a JSON configuration for a page builder (Puck).
      
      Your task is to modify the configuration based on the user's request.
      
      IMPORTANT: The configuration now includes a 'theme' object that controls ALL visual styling.
      Most visual changes should be made through the theme, NOT through component props.
      
      Theme Structure:
      - theme.colors.primary: Primary brand color
      - theme.colors.accent: Accent color
      - theme.colors.header.background: Header background color
      - theme.colors.header.text: Header text color
      - theme.colors.header.iconColor: Header icon color (search icon, etc.)
      - theme.colors.header.cartIconColor: Shopping cart icon color
      - theme.colors.header.searchBorder: Search bar border color
      - theme.colors.header.searchBackground: Search bar background color
      - theme.colors.footer.background: Footer background color
      - theme.colors.footer.text: Footer text color
      - theme.colors.footer.linkColor: Footer link color
      - theme.colors.footer.linkHoverColor: Footer link hover color
      
      Rules:
      1. Return ONLY the updated JSON configuration.
      2. Do NOT remove existing components unless explicitly asked.
      3. Maintain the integrity of the 'content', 'root', 'zones', and 'theme' structure.
      4. For visual/style changes (colors, icons, etc.), modify the 'theme' object.
      5. For content changes (text, images), modify the component props.
      6. If the user asks to change the cart icon color, update theme.colors.header.cartIconColor.
      7. If the user asks to change header colors, update theme.colors.header properties.
      8. If the user asks to change footer colors, update theme.colors.footer properties.
      9. For 'Features' component, you can set an 'icon' field. Valid icons: 'check', 'truck', 'shield', 'clock', 'zap', 'heart', 'award'.
      10. For colors, use standard CSS color values (hex codes like '#0000ff', color names like 'blue', or rgb values).
      11. If theme doesn't exist in current config, create it with the changes.
      
      Examples:
      - "make the cart icon blue" → { ...currentConfig, theme: { colors: { header: { cartIconColor: "#0000FF" } } } }
      - "change header background to dark" → { ...currentConfig, theme: { colors: { header: { background: "#1A202C", text: "#FFFFFF" } } } }
      - "make the search bar red" → { ...currentConfig, theme: { colors: { header: { searchBorder: "#FF0000" } } } }
      - "make footer links yellow" → { ...currentConfig, theme: { colors: { footer: { linkColor: "#FFFF00" } } } }
      
      Current Configuration:
      ${JSON.stringify(currentConfig, null, 2)}
    `;

        const result = await generateObject({
            model: geminiFlash,
            schema: puckDataSchema,
            system: systemPrompt,
            prompt: prompt,
        });

        // Deep merge theme if it exists
        let mergedTheme = currentConfig.theme || {};
        if (result.object.theme) {
            // Deep merge theme.colors
            if (result.object.theme.colors) {
                const existingColors = mergedTheme.colors || {};
                mergedTheme = {
                    ...mergedTheme,
                    colors: {
                        ...existingColors,
                        ...result.object.theme.colors,
                        header: {
                            ...(existingColors.header || {}),
                            ...(result.object.theme.colors.header || {}),
                        },
                        footer: {
                            ...(existingColors.footer || {}),
                            ...(result.object.theme.colors.footer || {}),
                        },
                    },
                };
            }
        }

        // Ensure all components have unique IDs (required by Puck)
        const configWithIds = {
            ...result.object,
            theme: mergedTheme,
            content: result.object.content.map((component: any, index: number) => ({
                ...component,
                props: {
                    ...component.props,
                    id: component.props?.id || `${component.type.toLowerCase()}-${Date.now()}-${index}`
                }
            }))
        };

        return NextResponse.json({ config: configWithIds });
    } catch (error) {
        console.error('AI Builder Error:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            error: error
        });
        return NextResponse.json({
            error: 'Failed to process AI request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
