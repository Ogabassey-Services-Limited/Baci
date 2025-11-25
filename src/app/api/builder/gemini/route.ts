import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Enhanced system prompt for comprehensive website modifications
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

## Response Format:
Return ONLY valid JSON matching the current configuration structure with your modifications applied.
Include ALL existing fields unless explicitly told to remove them.
Ensure all components have required props and proper types.

## Examples:
- "make the site blue" → Update theme.colors.primary to blue, adjust related colors
- "add a testimonials section" → Insert Testimonial component(s) in logical position
- "change hero title" → Update Hero component's title prop
- "make header sticky" → Update Header component's sticky prop to true
- "add social media icons" → Insert SocialIcons component with platform URLs

Remember: You're helping merchants create beautiful, functional storefronts. Be creative but professional.`;

export async function POST(req: Request) {
    try {
        const { prompt, currentConfig } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
        });

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: SYSTEM_PROMPT }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'I understand. I am a website builder AI assistant. I will help you modify your page builder configuration following all the guidelines. I will return only valid JSON with the requested modifications applied.' }],
                },
            ],
        });

        // Create the user message with context
        const userMessage = `Current Configuration:
\`\`\`json
${JSON.stringify(currentConfig, null, 2)}
\`\`\`

User Request: ${prompt}

Please return the complete updated configuration as valid JSON. Make intelligent modifications based on the request while preserving all existing structure and content unless explicitly asked to change or remove it.`;

        const result = await chat.sendMessage(userMessage);
        const response = result.response;
        const text = response.text();

        // Parse the JSON response
        let updatedConfig;
        try {
            // Try to extract JSON from code blocks if present
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
            const jsonText = jsonMatch ? jsonMatch[1] : text;
            updatedConfig = JSON.parse(jsonText);
        } catch (_) {
            console.error('Failed to parse AI response:', text);
            throw new Error('AI returned invalid JSON');
        }

        // Ensure all components have unique IDs
        if (updatedConfig.content && Array.isArray(updatedConfig.content)) {
            updatedConfig.content = updatedConfig.content.map((component: Record<string, unknown>, index: number) => ({
                ...component,
                props: {
                    ...(component.props as Record<string, unknown>),
                    id: (component.props as Record<string, unknown>)?.id || `${(component.type as string).toLowerCase()}-${Date.now()}-${index}`
                }
            }));
        }

        // Validate the structure
        if (!updatedConfig.content || !Array.isArray(updatedConfig.content)) {
            throw new Error('Invalid configuration structure: missing or invalid content array');
        }

        if (!updatedConfig.root) {
            updatedConfig.root = currentConfig.root || { title: 'Home' };
        }

        if (!updatedConfig.zones) {
            updatedConfig.zones = currentConfig.zones || {};
        }

        return NextResponse.json({ config: updatedConfig });
    } catch (error) {
        console.error('Gemini AI Builder Error:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json({
            error: 'Failed to process AI request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
