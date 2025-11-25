import { Config } from '@measured/puck';
import { ThemedButton } from '@/components/themed/themed-button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
    Star, Mail, Check, Quote, Truck, Shield, Clock, Zap, Heart, Award,
    Search as SearchIcon, Facebook, Instagram, Twitter, Linkedin, Youtube,
    ShoppingBag, Menu
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import Image from 'next/image';
import { ImagePickerField } from './fields/image-picker-field';
import { AnimatedWrapper } from './animated-wrapper';
import { StorefrontForm, FormField } from '@/components/storefront/storefront-form';

// ==================== TYPE DEFINITIONS ====================

// Common animation fields that can be added to any component
const animationFields = {
    animationType: {
        type: 'select' as const,
        label: 'Animation',
        options: [
            { label: 'None', value: 'none' },
            { label: 'Fade In', value: 'fade-in' },
            { label: 'Slide Up', value: 'slide-up' },
            { label: 'Slide Down', value: 'slide-down' },
            { label: 'Slide Left', value: 'slide-left' },
            { label: 'Slide Right', value: 'slide-right' },
            { label: 'Zoom In', value: 'zoom-in' },
            { label: 'Scale Up', value: 'scale-up' },
        ]
    },
    animationDuration: {
        type: 'select' as const,
        label: 'Animation Speed',
        options: [
            { label: 'Fast', value: 'fast' },
            { label: 'Normal', value: 'normal' },
            { label: 'Slow', value: 'slow' },
        ]
    },
    animationDelay: {
        type: 'number' as const,
        label: 'Animation Delay (seconds)',
        min: 0,
        max: 5,
        step: 0.1
    },
    animationTrigger: {
        type: 'select' as const,
        label: 'Animation Trigger',
        options: [
            { label: 'On Page Load', value: 'immediate' },
            { label: 'On Scroll Into View', value: 'scroll' },
        ]
    }
};

type HeroProps = {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    align: 'left' | 'center' | 'right';
    padding: 'small' | 'medium' | 'large';
    backgroundImage?: string;
    overlay?: boolean;
    animationType?: string;
    animationDuration?: string;
    animationDelay?: number;
    animationTrigger?: string;
};

type HeroCarouselProps = {
    slides: {
        image: string;
        title: string;
        subtitle: string;
        ctaText: string;
        ctaLink: string;
    }[];
    autoplayDelay?: number;
};

type TextProps = {
    title?: string;
    content: string;
    align: 'left' | 'center' | 'right';
    animationType?: string;
    animationDuration?: string;
    animationDelay?: number;
    animationTrigger?: string;
};

type ImageProps = {
    src: string;
    alt: string;
    aspectRatio: 'auto' | '16/9' | '4/3' | '1/1';
    link?: string;
    animationType?: string;
    animationDuration?: string;
    animationDelay?: number;
    animationTrigger?: string;
};

type ButtonProps = {
    text: string;
    link: string;
    variant: 'primary' | 'background' | 'accent';
    align: 'left' | 'center' | 'right';
    size: 'sm' | 'default' | 'lg';
};

type ProductGridProps = {
    title: string;
    columns: number;
    limit: number;
    category?: string;
    sortBy?: 'newest' | 'price-low' | 'price-high' | 'name';
};

type TestimonialProps = {
    quote: string;
    author: string;
    role: string;
    rating?: number;
    avatar?: string;
};

type FeaturesProps = {
    title: string;
    subtitle?: string;
    features: { title: string; description: string; icon?: string }[];
    columns?: number;
    animationType?: string;
    animationDuration?: string;
    animationDelay?: number;
    animationTrigger?: string;
};

type NewsletterProps = {
    title: string;
    description: string;
    buttonText: string;
    placeholder?: string;
};

type SpacerProps = {
    height: 'small' | 'medium' | 'large' | 'xlarge';
};

type FooterProps = {
    copyrightText?: string;
    showQuickLinks: boolean;
    quickLinks: { label: string; url: string }[];
    socialLinks: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        linkedin?: string;
        youtube?: string;
    };
    showNewsletter?: boolean;
    backgroundColor?: string;
    textColor?: string;
};

type HeaderProps = {
    showLogo: boolean;
    showSearch: boolean;
    showCart: boolean;
    showMenu: boolean;
    navigationLinks: { label: string; url: string }[];
    ctaButton?: {
        text: string;
        url: string;
        show: boolean;
    };
    backgroundColor?: string;
    textColor?: string;
    sticky?: boolean;
    logoUrl?: string;
    storeName?: string;
    // Granular Customization Props
    layout?: 'logo-left-nav-center' | 'logo-left-nav-right' | 'logo-center';
    searchStyle?: 'outline' | 'filled' | 'minimal';
    searchRadius?: 'none' | 'sm' | 'md' | 'full';
    paddingY?: 'sm' | 'md' | 'lg';
    glassEffect?: boolean;
};

type VideoProps = {
    url: string;
    title?: string;
    autoplay?: boolean;
    controls?: boolean;
};

type MapProps = {
    address: string;
    zoom: number;
    height?: string;
};

type InstagramFeedProps = {
    username: string;
    postsCount?: number;
};

type ContactFormProps = {
    formName: string;
    fields: FormField[];
    submitButtonText?: string;
    successMessage?: string;
    animationType?: string;
    animationDuration?: string;
    animationDelay?: number;
    animationTrigger?: string;
};

type SocialIconsProps = {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    size?: 'sm' | 'md' | 'lg';
    alignment?: 'left' | 'center' | 'right';
};

type CodeEmbedProps = {
    code: string;
    language?: string;
};

type SearchProps = {
    placeholder: string;
    showFilters?: boolean;
};

type RootProps = {
    title: string;
};

type _MetadataType = {
    merchantId?: string;
    merchant?: Record<string, unknown>;
    products?: Record<string, unknown>[];
};

// ==================== HELPER COMPONENTS ====================

function HeroCarouselComponent({ slides, autoplayDelay = 5000 }: HeroCarouselProps) {
    const plugin = Autoplay({ delay: autoplayDelay, stopOnInteraction: true });

    return (
        <section className="w-full relative">
            <Carousel
                className="w-full"
                plugins={[plugin]}
                opts={{ loop: true }}
            >
                <CarouselContent>
                    {slides.map((slide, index) => (
                        <CarouselItem key={index}>
                            <div className="w-full h-[60vh] md:h-[70vh] relative">
                                <Image
                                    src={slide.image}
                                    alt={slide.title}
                                    fill
                                    className="object-cover"
                                    priority={index === 0}
                                />
                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white p-4">
                                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
                                        {slide.title}
                                    </h1>
                                    <p className="text-lg md:text-xl max-w-2xl mb-8">
                                        {slide.subtitle}
                                    </p>
                                    <ThemedButton asChild size="lg" colorRole="accent">
                                        <Link href={slide.ctaLink}>
                                            {slide.ctaText}
                                        </Link>
                                    </ThemedButton>
                                </div>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex" />
                <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex" />
            </Carousel>
        </section>
    );
}

function CustomHeader({
    showLogo,
    showSearch,
    showCart,
    showMenu,
    navigationLinks,
    ctaButton,
    backgroundColor,
    textColor,
    sticky,
    logoUrl,
    storeName,
    layout = 'logo-left-nav-center',
    searchStyle = 'outline',
    searchRadius = 'md',
    paddingY = 'md',
    glassEffect = false
}: HeaderProps) {
    const paddingClasses = {
        sm: 'h-14',
        md: 'h-16',
        lg: 'h-20'
    };

    const searchClasses = {
        outline: 'bg-transparent border-input',
        filled: 'bg-muted border-transparent',
        minimal: 'bg-transparent border-transparent border-b border-input rounded-none px-0'
    };

    const radiusClasses = {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        full: 'rounded-full'
    };

    return (
        <header
            className={cn("px-4 lg:px-6 flex items-center gap-4 shadow-sm z-50 transition-all duration-300", {
                "sticky top-0": sticky,
                "backdrop-blur-md bg-opacity-80": glassEffect,
                "bg-white": !glassEffect && !backgroundColor
            })}
            style={{
                backgroundColor: backgroundColor || (glassEffect ? 'rgba(255, 255, 255, 0.8)' : 'var(--theme-header-bg, #FFFFFF)'),
                color: textColor || 'var(--theme-header-text, #000000)',
                height: 'auto',
                minHeight: paddingClasses[paddingY as keyof typeof paddingClasses] || '4rem'
            }}
        >
            {/* Logo Section */}
            {showLogo && (
                <div className={cn("flex items-center gap-2 font-semibold shrink-0", {
                    "order-1": layout === 'logo-left-nav-center' || layout === 'logo-left-nav-right',
                    "order-2 mx-auto": layout === 'logo-center',
                })}>
                    {logoUrl ? (
                        <Image
                            src={logoUrl}
                            alt="Store Logo"
                            width={32}
                            height={32}
                            className="w-8 h-8 object-contain rounded-md"
                        />
                    ) : (
                        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold">
                            L
                        </div>
                    )}
                    <span className="hidden sm:inline-block">{storeName || 'Your Store'}</span>
                </div>
            )}

            {/* Navigation Section */}
            {showMenu && navigationLinks.length > 0 && (
                <nav className={cn("hidden md:flex items-center gap-6", {
                    "order-2 mx-auto": layout === 'logo-left-nav-center',
                    "order-2 ml-auto mr-4": layout === 'logo-left-nav-right',
                    "order-1 mr-auto": layout === 'logo-center',
                })}>
                    {navigationLinks.map((link, index) => (
                        <Link
                            key={index}
                            href={link.url}
                            className="text-sm font-medium hover:text-primary transition-colors relative group"
                        >
                            {link.label}
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
                        </Link>
                    ))}
                </nav>
            )}

            {/* Spacer for Center Logo Layout to balance the grid */}
            {layout === 'logo-center' && <div className="flex-1 order-1 md:hidden" />}

            {/* Search Section */}
            {showSearch && (
                <div className={cn("flex-1 max-w-sm hidden md:block", {
                    "order-3": true,
                    "ml-auto": layout === 'logo-left-nav-center',
                })}>
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search..."
                            className={cn(
                                "w-full pl-9 transition-all focus-visible:ring-1",
                                searchClasses[searchStyle as keyof typeof searchClasses],
                                radiusClasses[searchRadius as keyof typeof radiusClasses]
                            )}
                        />
                    </div>
                </div>
            )}

            {/* Actions Section */}
            <div className={cn("flex items-center gap-3 shrink-0", {
                "order-4 ml-auto": true, // Always at the end
            })}>
                {ctaButton?.show && ctaButton.text && (
                    <ThemedButton asChild colorRole="primary" size="sm" className="hidden sm:inline-flex">
                        <Link href={ctaButton.url || '#'}>{ctaButton.text}</Link>
                    </ThemedButton>
                )}

                {showSearch && (
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <SearchIcon className="w-5 h-5" />
                    </Button>
                )}

                {showCart && (
                    <Button variant="ghost" size="icon" className="relative">
                        <ShoppingBag className="w-5 h-5" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full" />
                    </Button>
                )}

                {showMenu && (
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="w-5 h-5" />
                    </Button>
                )}
            </div>
        </header>
    );
}

function CustomFooter({
    copyrightText,
    showQuickLinks,
    quickLinks,
    socialLinks,
    showNewsletter,
    backgroundColor,
    textColor
}: FooterProps) {
    const socialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
        facebook: Facebook,
        instagram: Instagram,
        twitter: Twitter,
        linkedin: Linkedin,
        youtube: Youtube,
    };

    return (
        <footer
            className="mt-auto py-12"
            style={{
                backgroundColor: backgroundColor || 'var(--theme-footer-bg, #1A202C)',
                color: textColor || 'var(--theme-footer-text, #FFFFFF)',
            }}
        >
            <div className="container mx-auto px-4">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Your Store</h3>
                        <p className="text-sm opacity-80">
                            {copyrightText || `© ${new Date().getFullYear()} All rights reserved.`}
                        </p>
                    </div>

                    {showQuickLinks && quickLinks.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                            <nav className="flex flex-col gap-2">
                                {quickLinks.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url}
                                        className="text-sm hover:underline underline-offset-4 opacity-80 hover:opacity-100"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    )}

                    <div>
                        <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
                        <div className="flex gap-4">
                            {Object.entries(socialLinks).map(([platform, url]) => {
                                if (!url) return null;
                                const Icon = socialIcons[platform];
                                return (
                                    <Link
                                        key={platform}
                                        href={url}
                                        className="opacity-80 hover:opacity-100 transition-opacity"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Icon className="w-5 h-5" />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {showNewsletter && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Newsletter</h3>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="Your email"
                                    className="flex-1"
                                />
                                <Button size="sm">Subscribe</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </footer>
    );
}

// ==================== PUCK CONFIGURATION ====================

export const builderConfig: Config<{
    Header: HeaderProps;
    Hero: HeroProps;
    HeroCarousel: HeroCarouselProps;
    Text: TextProps;
    Image: ImageProps;
    Button: ButtonProps;
    ProductGrid: ProductGridProps;
    Testimonial: TestimonialProps;
    Features: FeaturesProps;
    Newsletter: NewsletterProps;
    Spacer: SpacerProps;
    Footer: FooterProps;
    Video: VideoProps;
    Map: MapProps;
    InstagramFeed: InstagramFeedProps;
    ContactForm: ContactFormProps;
    SocialIcons: SocialIconsProps;
    CodeEmbed: CodeEmbedProps;
    Search: SearchProps;
}, RootProps> = {
    categories: {
        layout: {
            title: 'Layout',
            components: ['Header', 'Hero', 'HeroCarousel', 'Text', 'Spacer', 'Features', 'Footer'],
        },
        media: {
            title: 'Media',
            components: ['Image', 'Video', 'Testimonial', 'InstagramFeed', 'Map'],
        },
        commerce: {
            title: 'Commerce',
            components: ['ProductGrid', 'Button', 'Newsletter', 'ContactForm', 'Search'],
        },
        advanced: {
            title: 'Advanced',
            components: ['SocialIcons', 'CodeEmbed'],
        },
    },
    root: {
        fields: {
            title: { type: 'text', label: 'Page Title' },
        },
        render: ({ children, title }) => {
            if (typeof document !== 'undefined' && title) {
                document.title = title;
            }
            return <>{children}</>;
        },
    },
    components: {
        Header: {
            label: 'Header Navigation',
            permissions: { delete: false, duplicate: false },
            fields: {
                showLogo: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                showSearch: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                showCart: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                showMenu: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                sticky: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                navigationLinks: {
                    type: 'array',
                    getItemSummary: (item) => item.label || 'Link',
                    arrayFields: {
                        label: { type: 'text' },
                        url: { type: 'text' },
                    },
                },
                ctaButton: {
                    type: 'object',
                    objectFields: {
                        show: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                        text: { type: 'text' },
                        url: { type: 'text' },
                    },
                },
                backgroundColor: { type: 'text', label: 'Background Color (hex)' },
                textColor: { type: 'text', label: 'Text Color (hex)' },

                // New Customization Fields
                layout: {
                    type: 'select',
                    label: 'Layout Style',
                    options: [
                        { label: 'Logo Left, Nav Center', value: 'logo-left-nav-center' },
                        { label: 'Logo Left, Nav Right', value: 'logo-left-nav-right' },
                        { label: 'Logo Center', value: 'logo-center' },
                    ]
                },
                searchStyle: {
                    type: 'radio',
                    label: 'Search Bar Style',
                    options: [
                        { label: 'Outline', value: 'outline' },
                        { label: 'Filled', value: 'filled' },
                        { label: 'Minimal', value: 'minimal' },
                    ]
                },
                searchRadius: {
                    type: 'radio',
                    label: 'Search Corner Radius',
                    options: [
                        { label: 'Square', value: 'none' },
                        { label: 'Small', value: 'sm' },
                        { label: 'Medium', value: 'md' },
                        { label: 'Round', value: 'full' },
                    ]
                },
                paddingY: {
                    type: 'select',
                    label: 'Vertical Padding',
                    options: [
                        { label: 'Compact', value: 'sm' },
                        { label: 'Standard', value: 'md' },
                        { label: 'Spacious', value: 'lg' },
                    ]
                },
                glassEffect: {
                    type: 'radio',
                    label: 'Glassmorphism Effect',
                    options: [
                        { label: 'Enabled', value: true },
                        { label: 'Disabled', value: false },
                    ]
                },
            },
            defaultProps: {
                showLogo: true,
                showSearch: true,
                showCart: true,
                showMenu: true,
                sticky: true,
                navigationLinks: [
                    { label: 'Home', url: '/' },
                    { label: 'Shop', url: '/products' },
                    { label: 'About', url: '/about' },
                ],
                ctaButton: {
                    show: false,
                    text: 'Get Started',
                    url: '/signup',
                },
                layout: 'logo-left-nav-center',
                searchStyle: 'outline',
                searchRadius: 'md',
                paddingY: 'md',
                glassEffect: false,
            },
            render: (props) => <CustomHeader {...props} />,
        },
        Hero: {
            label: 'Hero Section',
            permissions: { delete: true, duplicate: true },
            fields: {
                title: { type: 'text' },
                subtitle: { type: 'textarea' },
                ctaText: { type: 'text' },
                ctaLink: { type: 'text' },
                backgroundImage: {
                    type: 'custom',
                    label: 'Background Image (optional)',
                    render: ({ field, onChange, value }: { field: { label?: string }; onChange: (value: string) => void; value: string }) => {
                        return <ImagePickerField field={field} onChange={onChange} value={value} />;
                    }
                },
                overlay: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                align: {
                    type: 'select',
                    options: [
                        { label: 'Left', value: 'left' },
                        { label: 'Center', value: 'center' },
                        { label: 'Right', value: 'right' }
                    ]
                },
                padding: {
                    type: 'select',
                    options: [
                        { label: 'Small', value: 'small' },
                        { label: 'Medium', value: 'medium' },
                        { label: 'Large', value: 'large' }
                    ]
                },
                ...animationFields
            },
            defaultProps: {
                title: 'Welcome to Our Store',
                subtitle: 'Discover our amazing collection of products.',
                ctaText: 'Shop Now',
                ctaLink: '/products',
                align: 'center',
                padding: 'medium',
                overlay: false,
                animationType: 'fade-in',
                animationDuration: 'normal',
                animationDelay: 0,
                animationTrigger: 'scroll',
            },
            render: ({ title, subtitle, ctaText, ctaLink, align, padding, backgroundImage, overlay, animationType, animationDuration, animationDelay, animationTrigger }) => {
                const paddingClass = {
                    small: 'py-12',
                    medium: 'py-24',
                    large: 'py-32'
                }[padding];

                return (
                    <AnimatedWrapper
                        animation={{
                            type: animationType as 'fade' | 'slide' | 'zoom' | 'none',
                            duration: animationDuration as 'fast' | 'normal' | 'slow',
                            delay: animationDelay,
                            trigger: animationTrigger as 'onload' | 'scroll',
                        }}
                    >
                        <section className={cn("relative", paddingClass)} style={backgroundImage ? {
                            backgroundImage: `url(${backgroundImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        } : {}}>
                            {overlay && backgroundImage && (
                                <div className="absolute inset-0 bg-black/40" />
                            )}
                            <div className={cn("container px-4 md:px-6 flex flex-col gap-4 relative z-10", {
                                'items-start text-left': align === 'left',
                                'items-center text-center': align === 'center',
                                'items-end text-right': align === 'right',
                            }, {
                                'text-white': backgroundImage && overlay
                            })}>
                                <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">{title}</h1>
                                <p className="text-xl max-w-[700px] opacity-90">{subtitle}</p>
                                <ThemedButton colorRole="primary" size="lg" asChild>
                                    <Link href={ctaLink}>{ctaText}</Link>
                                </ThemedButton>
                            </div>
                        </section>
                    </AnimatedWrapper>
                );
            }
        },
        HeroCarousel: {
            label: 'Hero Carousel',
            permissions: { delete: true, duplicate: false },
            fields: {
                autoplayDelay: {
                    type: 'number',
                    label: 'Autoplay Delay (ms)',
                    min: 1000,
                    max: 10000,
                },
                slides: {
                    type: 'array',
                    getItemSummary: (item) => item.title || 'Slide',
                    arrayFields: {
                        image: { type: 'text', label: 'Image URL' },
                        title: { type: 'text' },
                        subtitle: { type: 'textarea' },
                        ctaText: { type: 'text' },
                        ctaLink: { type: 'text' }
                    }
                }
            },
            defaultProps: {
                autoplayDelay: 5000,
                slides: [
                    {
                        image: '/placeholder-hero.jpg',
                        title: 'Welcome to Our Store',
                        subtitle: 'Discover our amazing collection.',
                        ctaText: 'Shop Now',
                        ctaLink: '#products'
                    },
                    {
                        image: '/placeholder-hero-2.jpg',
                        title: 'New Arrivals',
                        subtitle: 'Check out the latest trends.',
                        ctaText: 'View Collection',
                        ctaLink: '#products'
                    }
                ]
            },
            render: ({ slides, autoplayDelay }) => <HeroCarouselComponent slides={slides} autoplayDelay={autoplayDelay} />
        },
        Text: {
            label: 'Text Block',
            permissions: { delete: true, duplicate: true },
            fields: {
                title: { type: 'text' },
                content: { type: 'textarea' },
                align: {
                    type: 'select',
                    options: [
                        { label: 'Left', value: 'left' },
                        { label: 'Center', value: 'center' },
                        { label: 'Right', value: 'right' }
                    ]
                },
                ...animationFields
            },
            defaultProps: {
                title: 'About Us',
                content: 'Write something about your brand here.',
                align: 'left',
                animationType: 'fade-in',
                animationDuration: 'normal',
                animationDelay: 0,
                animationTrigger: 'scroll',
            },
            render: ({ title, content, align, animationType, animationDuration, animationDelay, animationTrigger }) => (
                <AnimatedWrapper
                    animation={{
                        type: animationType as 'fade' | 'slide' | 'zoom' | 'none',
                        duration: animationDuration as 'fast' | 'normal' | 'slow',
                        delay: animationDelay,
                        trigger: animationTrigger as 'onload' | 'scroll',
                    }}
                >
                    <section className="py-12 container px-4 md:px-6">
                        <div className={cn("max-w-3xl mx-auto", {
                            'text-left': align === 'left',
                            'text-center': align === 'center',
                            'text-right': align === 'right',
                        })}>
                            {title && <h2 className="text-3xl font-bold mb-4">{title}</h2>}
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-lg whitespace-pre-wrap">{content}</p>
                            </div>
                        </div>
                    </section>
                </AnimatedWrapper>
            )
        },
        Image: {
            label: 'Image',
            permissions: { delete: true, duplicate: true },
            fields: {
                src: {
                    type: 'custom',
                    label: 'Image',
                    render: ({ field, onChange, value }: { field: { label?: string }; onChange: (value: string) => void; value: string }) => {
                        return <ImagePickerField field={field} onChange={onChange} value={value} />;
                    }
                },
                alt: { type: 'text', label: 'Alt Text' },
                link: { type: 'text', label: 'Link URL (optional)' },
                aspectRatio: {
                    type: 'select',
                    options: [
                        { label: 'Auto', value: 'auto' },
                        { label: '16:9', value: '16/9' },
                        { label: '4:3', value: '4/3' },
                        { label: '1:1', value: '1/1' }
                    ]
                },
                ...animationFields
            },
            defaultProps: {
                src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
                alt: 'Product image',
                aspectRatio: '16/9',
                animationType: 'zoom-in',
                animationDuration: 'normal',
                animationDelay: 0,
                animationTrigger: 'scroll',
            },
            render: ({ src, alt, aspectRatio, link, animationType, animationDuration, animationDelay, animationTrigger }) => {
                const imageElement = (
                    <div
                        className="relative w-full overflow-hidden rounded-lg bg-muted"
                        style={{ aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio }}
                    >
                        <Image
                            src={src}
                            alt={alt}
                            fill
                            className="object-cover"
                        />
                    </div>
                );

                return (
                    <AnimatedWrapper
                        animation={{
                            type: animationType as 'fade' | 'slide' | 'zoom' | 'none',
                            duration: animationDuration as 'fast' | 'normal' | 'slow',
                            delay: animationDelay,
                            trigger: animationTrigger as 'onload' | 'scroll',
                        }}
                    >
                        <section className="py-8 container px-4 md:px-6">
                            {link ? (
                                <Link href={link} className="block hover:opacity-90 transition-opacity">
                                    {imageElement}
                                </Link>
                            ) : imageElement}
                        </section>
                    </AnimatedWrapper>
                );
            }
        },
        Button: {
            label: 'Button',
            permissions: { delete: true, duplicate: true },
            inline: true,
            fields: {
                text: { type: 'text' },
                link: { type: 'text' },
                size: {
                    type: 'select',
                    options: [
                        { label: 'Small', value: 'sm' },
                        { label: 'Default', value: 'default' },
                        { label: 'Large', value: 'lg' }
                    ]
                },
                variant: {
                    type: 'select',
                    options: [
                        { label: 'Primary', value: 'primary' },
                        { label: 'Background', value: 'background' },
                        { label: 'Accent', value: 'accent' }
                    ]
                },
                align: {
                    type: 'select',
                    options: [
                        { label: 'Left', value: 'left' },
                        { label: 'Center', value: 'center' },
                        { label: 'Right', value: 'right' }
                    ]
                }
            },
            defaultProps: {
                text: 'Click Me',
                link: '#',
                variant: 'primary',
                align: 'center',
                size: 'default',
            },
            render: ({ text, link, variant, align, size, puck }) => (
                <div
                    ref={puck.dragRef}
                    className={cn("py-4 container px-4 md:px-6 flex", {
                        'justify-start': align === 'left',
                        'justify-center': align === 'center',
                        'justify-end': align === 'right',
                    })}
                >
                    <ThemedButton colorRole={variant} size={size} asChild>
                        <Link href={link}>{text}</Link>
                    </ThemedButton>
                </div>
            )
        },
        ProductGrid: {
            label: 'Product Grid',
            permissions: { delete: true, duplicate: true },
            fields: {
                title: { type: 'text' },
                columns: { type: 'number', min: 1, max: 4 },
                limit: { type: 'number', min: 1, max: 24 },
                category: { type: 'text', label: 'Filter by Category (optional)' },
                sortBy: {
                    type: 'select',
                    label: 'Sort By',
                    options: [
                        { label: 'Newest', value: 'newest' },
                        { label: 'Price: Low to High', value: 'price-low' },
                        { label: 'Price: High to Low', value: 'price-high' },
                        { label: 'Name', value: 'name' },
                    ]
                },
                showFilters: {
                    type: 'radio',
                    label: 'Show Filter Dropdown',
                    options: [
                        { label: 'Yes', value: true },
                        { label: 'No', value: false }
                    ]
                }
            },
            defaultProps: {
                title: 'Featured Products',
                columns: 3,
                limit: 6,
                sortBy: 'newest',
                showFilters: true,
            },
            // Removed resolveData to avoid type issues
            render: (props) => <StorefrontProductGrid {...props} />
        },
        Footer: {
            label: 'Footer',
            permissions: { delete: false, duplicate: false },
            fields: {
                copyrightText: { type: 'text', label: 'Copyright Text' },
                showQuickLinks: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                quickLinks: {
                    type: 'array',
                    getItemSummary: (item) => item.label || 'Link',
                    arrayFields: {
                        label: { type: 'text' },
                        url: { type: 'text' },
                    },
                },
                socialLinks: {
                    type: 'object',
                    objectFields: {
                        facebook: { type: 'text', label: 'Facebook URL' },
                        instagram: { type: 'text', label: 'Instagram URL' },
                        twitter: { type: 'text', label: 'Twitter URL' },
                        linkedin: { type: 'text', label: 'LinkedIn URL' },
                        youtube: { type: 'text', label: 'YouTube URL' },
                    },
                },
                showNewsletter: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                backgroundColor: { type: 'text', label: 'Background Color (hex)' },
                textColor: { type: 'text', label: 'Text Color (hex)' },
            },
            defaultProps: {
                showQuickLinks: true,
                quickLinks: [
                    { label: 'About Us', url: '/about' },
                    { label: 'Contact', url: '/contact' },
                    { label: 'Privacy Policy', url: '/privacy' },
                    { label: 'Terms', url: '/terms' },
                ],
                socialLinks: {},
                showNewsletter: false,
            },
            render: (props) => <CustomFooter {...props} />,
        },
        Testimonial: {
            label: 'Testimonial',
            permissions: { delete: true, duplicate: true },
            fields: {
                quote: { type: 'textarea' },
                author: { type: 'text' },
                role: { type: 'text' },
                avatar: { type: 'text', label: 'Avatar URL (optional)' },
                rating: {
                    type: 'number',
                    min: 0,
                    max: 5,
                    label: 'Rating (0-5)'
                }
            },
            defaultProps: {
                quote: "This is the best product I've ever used. Highly recommended!",
                author: "Jane Doe",
                role: "Verified Customer",
                rating: 5,
            },
            render: ({ quote, author, role, avatar, rating = 5 }) => (
                <section className="py-12 container px-4 md:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <Quote className="w-12 h-12 mx-auto mb-6 text-muted-foreground/20" />
                        <blockquote className="text-2xl font-medium mb-6">"{quote}"</blockquote>
                        <div className="flex flex-col items-center gap-3">
                            {avatar && (
                                <Image
                                    src={avatar}
                                    alt={author}
                                    width={48}
                                    height={48}
                                    className="rounded-full"
                                />
                            )}
                            <div>
                                <div className="font-semibold">{author}</div>
                                <div className="text-sm text-muted-foreground">{role}</div>
                            </div>
                            <div className="flex gap-1 text-yellow-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={cn("w-4 h-4", {
                                            "fill-current": i < rating
                                        })}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )
        },
        Features: {
            label: 'Features Section',
            permissions: { delete: true, duplicate: true },
            fields: {
                title: { type: 'text' },
                subtitle: { type: 'textarea', label: 'Subtitle (optional)' },
                columns: {
                    type: 'select',
                    options: [
                        { label: '2 Columns', value: 2 },
                        { label: '3 Columns', value: 3 },
                        { label: '4 Columns', value: 4 },
                    ]
                },
                features: {
                    type: 'array',
                    getItemSummary: (item) => item.title || 'Feature',
                    arrayFields: {
                        title: { type: 'text' },
                        description: { type: 'textarea' },
                        icon: {
                            type: 'select',
                            options: [
                                { label: 'Check', value: 'check' },
                                { label: 'Truck', value: 'truck' },
                                { label: 'Shield', value: 'shield' },
                                { label: 'Clock', value: 'clock' },
                                { label: 'Zap', value: 'zap' },
                                { label: 'Heart', value: 'heart' },
                                { label: 'Award', value: 'award' }
                            ]
                        }
                    }
                },
                ...animationFields
            },
            defaultProps: {
                title: 'Why Choose Us',
                columns: 3,
                features: [
                    { title: 'Premium Quality', description: 'We use only the finest materials.', icon: 'award' },
                    { title: 'Fast Shipping', description: 'Get your order in 2-3 business days.', icon: 'truck' },
                    { title: '24/7 Support', description: 'We are here to help anytime.', icon: 'clock' }
                ],
                animationType: 'slide-up',
                animationDuration: 'normal',
                animationDelay: 0,
                animationTrigger: 'scroll',
            },
            render: ({ title, subtitle, features, columns = 3, animationType, animationDuration, animationDelay, animationTrigger }) => {
                const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                    check: Check,
                    truck: Truck,
                    shield: Shield,
                    clock: Clock,
                    zap: Zap,
                    heart: Heart,
                    award: Award
                };

                return (
                    <AnimatedWrapper
                        animation={{
                            type: animationType as 'fade' | 'slide' | 'zoom' | 'none',
                            duration: animationDuration as 'fast' | 'normal' | 'slow',
                            delay: animationDelay,
                            trigger: animationTrigger as 'onload' | 'scroll',
                        }}
                    >
                        <section className="py-12 container px-4 md:px-6 bg-muted/30">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl font-bold mb-4">{title}</h2>
                                {subtitle && <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
                            </div>
                            <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-8`}>
                                {features.map((feature, i) => {
                                    const IconComponent = iconMap[feature.icon as string] || Check;
                                    return (
                                        <div key={i} className="flex flex-col items-center text-center p-6 bg-background rounded-lg shadow-sm">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                                                <IconComponent className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                                            <p className="text-muted-foreground">{feature.description}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </AnimatedWrapper>
                );
            }
        },
        Newsletter: {
            label: 'Newsletter Signup',
            permissions: { delete: true, duplicate: true },
            fields: {
                title: { type: 'text' },
                description: { type: 'textarea' },
                placeholder: { type: 'text', label: 'Email Placeholder' },
                buttonText: { type: 'text' }
            },
            defaultProps: {
                title: 'Subscribe to our newsletter',
                description: 'Get the latest updates and offers directly in your inbox.',
                placeholder: 'Enter your email',
                buttonText: 'Subscribe'
            },
            render: ({ title, description, buttonText, placeholder }) => (
                <section className="py-16 container px-4 md:px-6">
                    <div className="bg-primary text-primary-foreground rounded-2xl p-8 md:p-12 text-center max-w-4xl mx-auto">
                        <Mail className="w-12 h-12 mx-auto mb-6 opacity-80" />
                        <h2 className="text-3xl font-bold mb-4">{title}</h2>
                        <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">{description}</p>
                        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                            <Input
                                type="email"
                                placeholder={placeholder}
                                className="bg-background text-foreground border-0"
                            />
                            <Button variant="secondary" size="lg">
                                {buttonText}
                            </Button>
                        </div>
                    </div>
                </section>
            )
        },
        Spacer: {
            label: 'Spacer',
            permissions: { delete: true, duplicate: true },
            fields: {
                height: {
                    type: 'select',
                    options: [
                        { label: 'Small (2rem)', value: 'small' },
                        { label: 'Medium (4rem)', value: 'medium' },
                        { label: 'Large (8rem)', value: 'large' },
                        { label: 'Extra Large (12rem)', value: 'xlarge' }
                    ]
                }
            },
            defaultProps: {
                height: 'medium'
            },
            render: ({ height }) => {
                const heightClass = {
                    small: 'h-8',
                    medium: 'h-16',
                    large: 'h-32',
                    xlarge: 'h-48'
                }[height] || 'h-16';
                return <div className={heightClass} />;
            }
        },
        Video: {
            label: 'Video Embed',
            permissions: { delete: true, duplicate: true },
            fields: {
                url: { type: 'text', label: 'YouTube or Vimeo URL' },
                title: { type: 'text', label: 'Video Title (optional)' },
                autoplay: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                controls: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
            },
            defaultProps: {
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                autoplay: false,
                controls: true,
            },
            render: ({ url, title, autoplay, controls }) => {
                // Extract video ID from YouTube/Vimeo URLs
                let embedUrl = '';
                if (url.includes('youtube.com') || url.includes('youtu.be')) {
                    const videoId = url.includes('youtu.be')
                        ? url.split('youtu.be/')[1]?.split('?')[0]
                        : url.split('v=')[1]?.split('&')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&controls=${controls ? 1 : 0}`;
                } else if (url.includes('vimeo.com')) {
                    const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
                    embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=${autoplay ? 1 : 0}`;
                }

                return (
                    <section className="py-8 container px-4 md:px-6">
                        {title && <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>}
                        <div className="aspect-video bg-muted flex items-center justify-center rounded-lg overflow-hidden">
                            {embedUrl ? (
                                <iframe
                                    src={embedUrl}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <p className="text-muted-foreground">Invalid video URL</p>
                            )}
                        </div>
                    </section>
                );
            }
        },
        Map: {
            label: 'Map Embed',
            permissions: { delete: true, duplicate: true },
            fields: {
                address: { type: 'text', label: 'Address or Location' },
                zoom: { type: 'number', min: 1, max: 20 },
                height: {
                    type: 'select',
                    options: [
                        { label: 'Small', value: '300px' },
                        { label: 'Medium', value: '450px' },
                        { label: 'Large', value: '600px' },
                    ]
                }
            },
            defaultProps: {
                address: 'New York, NY',
                zoom: 12,
                height: '450px',
            },
            render: ({ address, zoom, height }) => {
                const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=${zoom}&ie=UTF8&iwloc=&output=embed`;

                return (
                    <section className="py-8 container px-4 md:px-6">
                        <div
                            className="w-full bg-muted rounded-lg overflow-hidden border"
                            style={{ height }}
                        >
                            <iframe
                                src={mapUrl}
                                className="w-full h-full"
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </section>
                );
            }
        },
        InstagramFeed: {
            label: 'Instagram Feed',
            permissions: { delete: true, duplicate: true },
            fields: {
                username: { type: 'text' },
                postsCount: {
                    type: 'number',
                    min: 1,
                    max: 12,
                    label: 'Number of Posts'
                }
            },
            defaultProps: {
                username: 'instagram',
                postsCount: 6,
            },
            render: ({ username, postsCount }) => (
                <section className="py-8 container px-4 md:px-6">
                    <div className="p-8 bg-muted text-center rounded-lg border">
                        <Instagram className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">Instagram Feed</h3>
                        <p className="text-muted-foreground mb-4">@{username} - {postsCount} recent posts</p>
                        <p className="text-sm text-muted-foreground">
                            Connect your Instagram account to display real posts
                        </p>
                    </div>
                </section>
            )
        },
        ContactForm: {
            label: 'Contact Form',
            permissions: { delete: true, duplicate: true },
            fields: {
                formName: { type: 'text', label: 'Form Name' },
                fields: {
                    type: 'array',
                    label: 'Form Fields',
                    getItemSummary: (item: FormField) => item.label || 'Field',
                    arrayFields: {
                        id: { type: 'text', label: 'Field ID (unique)' },
                        label: { type: 'text', label: 'Field Label' },
                        type: {
                            type: 'select',
                            label: 'Field Type',
                            options: [
                                { label: 'Text', value: 'text' },
                                { label: 'Email', value: 'email' },
                                { label: 'Phone', value: 'phone' },
                                { label: 'Text Area', value: 'textarea' },
                                { label: 'Select Dropdown', value: 'select' },
                                { label: 'Checkbox', value: 'checkbox' },
                            ]
                        },
                        placeholder: { type: 'text', label: 'Placeholder (optional)' },
                        required: {
                            type: 'radio',
                            label: 'Required?',
                            options: [
                                { label: 'Yes', value: true },
                                { label: 'No', value: false }
                            ]
                        },
                        options: {
                            type: 'textarea',
                            label: 'Options (for select, one per line)',
                        }
                    }
                },
                submitButtonText: { type: 'text', label: 'Submit Button Text' },
                successMessage: { type: 'textarea', label: 'Success Message' },
                ...animationFields
            },
            defaultProps: {
                formName: 'Contact Form',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', placeholder: 'Your name', required: true },
                    { id: 'email', type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
                    { id: 'phone', type: 'phone', label: 'Phone', placeholder: '(123) 456-7890', required: false },
                    { id: 'message', type: 'textarea', label: 'Message', placeholder: 'How can we help?', required: true },
                ],
                submitButtonText: 'Send Message',
                successMessage: 'Thank you! We\'ll get back to you soon.',
                animationType: 'fade-in',
                animationDuration: 'normal',
                animationDelay: 0,
                animationTrigger: 'scroll',
            },
            render: ({ formName, fields, submitButtonText, successMessage, animationType, animationDuration, animationDelay, animationTrigger }: ContactFormProps) => {
                // Ensure each field has a unique ID
                const formFields = fields.map((field: Record<string, unknown>, index: number) => ({
                    ...field,
                    id: field.id || `field-${index}`,
                    // Convert options from textarea string to array
                    options: field.options ? (field.options as string).split('\n').map((opt: string) => opt.trim()).filter(Boolean) : undefined
                }));

                return (
                    <AnimatedWrapper
                        animation={{
                            type: animationType as 'fade' | 'slide' | 'zoom' | 'none',
                            duration: animationDuration as 'fast' | 'normal' | 'slow',
                            delay: animationDelay,
                            trigger: animationTrigger as 'onload' | 'scroll',
                        }}
                    >
                        <section className="py-12 container px-4 md:px-6">
                            <div className="max-w-md mx-auto p-8 border rounded-lg bg-card">
                                <h3 className="text-2xl font-bold mb-6">{formName}</h3>
                                <StorefrontForm
                                    formName={formName}
                                    fields={formFields}
                                    submitButtonText={submitButtonText}
                                    successMessage={successMessage}
                                    merchantId={''} // Placeholder as we can't access puck context here easily
                                />
                            </div>
                        </section>
                    </AnimatedWrapper>
                );
            }
        },
        SocialIcons: {
            label: 'Social Icons',
            permissions: { delete: true, duplicate: true },
            inline: true,
            fields: {
                facebook: { type: 'text', label: 'Facebook URL' },
                instagram: { type: 'text', label: 'Instagram URL' },
                twitter: { type: 'text', label: 'Twitter URL' },
                linkedin: { type: 'text', label: 'LinkedIn URL' },
                youtube: { type: 'text', label: 'YouTube URL' },
                size: {
                    type: 'select',
                    options: [
                        { label: 'Small', value: 'sm' },
                        { label: 'Medium', value: 'md' },
                        { label: 'Large', value: 'lg' },
                    ]
                },
                alignment: {
                    type: 'select',
                    options: [
                        { label: 'Left', value: 'left' },
                        { label: 'Center', value: 'center' },
                        { label: 'Right', value: 'right' },
                    ]
                }
            },
            defaultProps: {
                size: 'md',
                alignment: 'center',
            },
            render: ({ facebook, instagram, twitter, linkedin, youtube, size, alignment, puck }) => {
                const sizeMap = {
                    sm: 'w-6 h-6',
                    md: 'w-8 h-8',
                    lg: 'w-10 h-10',
                };

                const socialIcons = [
                    { Icon: Facebook, url: facebook },
                    { Icon: Instagram, url: instagram },
                    { Icon: Twitter, url: twitter },
                    { Icon: Linkedin, url: linkedin },
                    { Icon: Youtube, url: youtube },
                ].filter(({ url }) => url);

                return (
                    <div
                        ref={puck.dragRef}
                        className={cn("flex gap-4 p-4", {
                            'justify-start': alignment === 'left',
                            'justify-center': alignment === 'center',
                            'justify-end': alignment === 'right',
                        })}
                    >
                        {socialIcons.map(({ Icon, url }, index) => (
                            <Link
                                key={index}
                                href={url!}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon className={sizeMap[size]} />
                            </Link>
                        ))}
                    </div>
                );
            }
        },
        CodeEmbed: {
            label: 'Custom Code',
            permissions: { delete: true, duplicate: true },
            fields: {
                code: { type: 'textarea', label: 'HTML/JavaScript Code' },
                language: {
                    type: 'select',
                    options: [
                        { label: 'HTML', value: 'html' },
                        { label: 'JavaScript', value: 'javascript' },
                    ]
                }
            },
            defaultProps: {
                code: '<div>Custom Code</div>',
                language: 'html',
            },
            render: ({ code, language }) => (
                <section className="py-8 container px-4 md:px-6">
                    <div className="bg-muted p-4 rounded-lg overflow-x-auto">
                        <pre className="text-sm">
                            <code className={language ? `language-${language}` : ''}>{code}</code>
                        </pre>
                    </div>
                </section>
            )
        },
        Search: {
            label: 'Search Bar',
            permissions: { delete: true, duplicate: true },
            fields: {
                placeholder: { type: 'text' },
                showFilters: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
            },
            defaultProps: {
                placeholder: 'Search products...',
                showFilters: false,
            },
            render: ({ placeholder, showFilters }) => (
                <section className="py-8 container px-4 md:px-6">
                    <div className="max-w-2xl mx-auto">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                className="pl-10 h-12 text-lg"
                                placeholder={placeholder}
                            />
                        </div>
                        {showFilters && (
                            <div className="flex gap-2 mt-4 flex-wrap">
                                <Button variant="outline" size="sm">All</Button>
                                <Button variant="outline" size="sm">Category 1</Button>
                                <Button variant="outline" size="sm">Category 2</Button>
                                <Button variant="outline" size="sm">Category 3</Button>
                            </div>
                        )}
                    </div>
                </section>
            )
        }
    }
};
