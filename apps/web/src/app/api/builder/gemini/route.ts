import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import z from 'zod';
import {
  AI_RATE_LIMITS,
  activeTextModel,
  checkRateLimit,
  sanitizePromptInput,
  withRetry,
} from '@/ai/provider';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';

// Puck configuration schema for structured output
const PuckComponentSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.any()),
});

const PuckThemeColorsSchema = z
  .object({
    primary: z.string().optional(),
    accent: z.string().optional(),
    header: z
      .object({
        background: z.string().optional(),
        text: z.string().optional(),
        iconColor: z.string().optional(),

        searchBorder: z.string().optional(),
        searchBackground: z.string().optional(),
      })
      .optional(),
    footer: z
      .object({
        background: z.string().optional(),
        text: z.string().optional(),
        linkColor: z.string().optional(),
        linkHoverColor: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const PuckConfigSchema = z
  .object({
    content: z.array(PuckComponentSchema),
    root: z
      .object({
        title: z.string().optional(),
      })
      .passthrough(),
    zones: z.record(z.string(), z.any()).optional(),
    theme: z
      .object({
        colors: PuckThemeColorsSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// System prompt for the AI builder
const SYSTEM_PROMPT = `You are an expert website builder AI assistant with deep knowledge of e-commerce storefronts, UX/UI design, and modern web technologies.

Your role is to help merchants build and customize their online stores by modifying a Puck-based page builder configuration.

## Available Components:
1. **Header** - Navigation bar with logo, search, cart, menu links, CTA button
2. **Hero** - Large hero section with title, subtitle, CTA, optional background image
3. **HeroCarousel** - Automatic rotating hero slides
4. **Text** - Rich text content blocks
5. **Image** - Images with optional links and aspect ratios
6. **Button** - Call-to-action buttons (can be inline)
7. **ProductGrid** - Product listing with category filters and sorting
8. **Testimonial** - Customer reviews with ratings and avatars
9. **Features** - Feature highlights with icons
10. **Newsletter** - Email signup form
11. **Spacer** - Vertical spacing control
12. **Footer** - Footer with links, social media, newsletter
13. **Video** - YouTube/Vimeo embeds
14. **Map** - Google Maps embed
15. **InstagramFeed** - Instagram feed placeholder
16. **ContactForm** - Contact form with customizable fields
17. **SocialIcons** - Social media icon links
18. **CodeEmbed** - Custom HTML/JavaScript
19. **Search** - Search bar with optional filters

## Theme System:
The configuration includes a powerful theme system that controls ALL visual styling:
- **colors.primary**: Primary brand color (buttons, accents)
- **colors.accent**: Secondary accent color
- **colors.header**: Header styling (background, text, icons, search bar)
- **colors.footer**: Footer styling (background, text, links)
- **typography**: Font families, sizes, line heights
- **spacing**: Padding, margins, container widths
- **borders**: Border radius, widths
- **effects**: Shadows, transitions

## Guidelines:
1. **Preserve Structure**: Never remove existing content unless explicitly requested
2. **Theme First**: For visual changes (colors, fonts, spacing), modify the theme object
3. **Component Props**: For content changes (text, images, links), modify component props
4. **Smart Defaults**: Use professional, e-commerce appropriate defaults
5. **Responsive**: Consider mobile users in your suggestions
6. **Accessibility**: Maintain good contrast ratios and semantic structure
7. **Performance**: Optimize image sizes and avoid excessive components
8. **SEO**: Include relevant titles, descriptions, and alt text
9. **Brand Consistency**: Keep colors and styles consistent across components
10. **User Intent**: Interpret requests intelligently (e.g., "make it blue" → update theme colors)

## Common Patterns:
- **Color changes**: Update theme.colors
- **Add section**: Insert new component in content array
- **Reorder**: Move components in content array
- **Style tweaks**: Update theme properties
- **Content updates**: Modify component props
- **Layout changes**: Adjust component positioning and properties

## Examples:
- "make the site blue" → Update theme.colors.primary to blue, adjust related colors
- "add a testimonials section" → Insert Testimonial component(s) in logical position
- "change hero title" → Update Hero component's title prop
- "make header sticky" → Update Header component's sticky prop to true
- "add social media icons" → Insert SocialIcons component with platform URLs

Remember: You're helping merchants create beautiful, functional storefronts. Be creative but professional.`;

export async function POST(req: Request) {
  try {
    // Auth check - supports both cookie (web) and Bearer token (mobile)
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;

    // Rate limiting
    const rateLimit = checkRateLimit(
      `builder:${user.id}`,
      AI_RATE_LIMITS.builder
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: `Please wait ${Math.ceil(rateLimit.resetIn / 1000)} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000)),
          },
        }
      );
    }

    const { prompt, currentConfig } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Sanitize the user prompt
    const sanitizedPrompt = sanitizePromptInput(prompt, 1000).value;

    if (!sanitizedPrompt) {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }

    // Generate the updated config using Vercel AI SDK with retry logic
    const result = await withRetry(async () => {
      return await generateObject({
        model: activeTextModel,
        schema: PuckConfigSchema,
        system: SYSTEM_PROMPT,
        prompt: `Current Configuration:
\`\`\`json
${JSON.stringify(currentConfig, null, 2)}
\`\`\`

User Request: ${sanitizedPrompt}

Please return the complete updated configuration as valid JSON. Make intelligent modifications based on the request while preserving all existing structure and content unless explicitly asked to change or remove it.`,
      });
    });

    let updatedConfig = result.object;

    // Deep merge theme if it exists
    let mergedTheme = currentConfig.theme || {};
    if (updatedConfig.theme) {
      if (updatedConfig.theme.colors) {
        const existingColors = mergedTheme.colors || {};
        mergedTheme = {
          ...mergedTheme,
          colors: {
            ...existingColors,
            ...updatedConfig.theme.colors,
            header: {
              ...(existingColors.header || {}),
              ...(updatedConfig.theme.colors.header || {}),
            },
            footer: {
              ...(existingColors.footer || {}),
              ...(updatedConfig.theme.colors.footer || {}),
            },
          },
        };
      }
    }

    // Ensure all components have unique IDs
    if (updatedConfig.content && Array.isArray(updatedConfig.content)) {
      const contentWithIds = updatedConfig.content.map((component, index) => ({
        ...component,
        props: {
          ...component.props,
          id:
            component.props?.id ||
            `${component.type.toLowerCase()}-${Date.now()}-${index}`,
        },
      }));
      updatedConfig = {
        ...updatedConfig,
        theme: mergedTheme,
        content: contentWithIds,
      };
    }

    // Validate the structure
    if (!updatedConfig.content || !Array.isArray(updatedConfig.content)) {
      throw new Error(
        'Invalid configuration structure: missing or invalid content array'
      );
    }

    if (!updatedConfig.root) {
      updatedConfig.root = currentConfig.root || { title: 'Home' };
    }

    if (!updatedConfig.zones) {
      updatedConfig.zones = currentConfig.zones || {};
    }

    return NextResponse.json(
      { config: updatedConfig },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    // Log full error details server-side for debugging
    console.error('Gemini AI Builder Error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return generic error message to client to avoid exposing internal details
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        details: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
