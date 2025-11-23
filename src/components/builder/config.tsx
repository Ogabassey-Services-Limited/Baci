import { Config, Fields } from '@measured/puck';
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
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

// ==================== TYPE DEFINITIONS ====================

type HeroProps = {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    align: 'left' | 'center' | 'right';
    padding: 'small' | 'medium' | 'large';
    backgroundImage?: string;
    overlay?: boolean;
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
};

type ImageProps = {
    src: string;
    alt: string;
    aspectRatio: 'auto' | '16/9' | '4/3' | '1/1';
    link?: string;
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
    email: string;
    title?: string;
    showPhone?: boolean;
    showMessage?: boolean;
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

type MetadataType = {
    merchantId?: string;
    merchant?: any;
    products?: any[];
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
    sticky
}: HeaderProps) {
    return (
        <header
            className={cn("px-4 lg:px-6 flex items-center gap-4 shadow-sm z-50", {
                "sticky top-0": sticky
            })}
            style={{
                backgroundColor: backgroundColor || 'var(--theme-header-bg, #FFFFFF)',
                color: textColor || 'var(--theme-header-text, #000000)',
                height: '4rem',
            }}
        >
            {showLogo && (
                <div className="flex items-center gap-2 font-semibold">
                    <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold">
                        L
                    </div>
                    <span className="hidden sm:inline-block">Your Store</span>
                </div>
            )}

            {showMenu && navigationLinks.length > 0 && (
                <nav className="hidden md:flex items-center gap-4 ml-4">
                    {navigationLinks.map((link, index) => (
                        <Link
                            key={index}
                            href={link.url}
                            className="text-sm font-medium hover:underline underline-offset-4"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            )}

            <div className="flex-1" />

            {showSearch && (
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search..."
                            className="w-full pl-8"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2">
                {ctaButton?.show && ctaButton.text && (
                    <ThemedButton asChild colorRole="primary" size="sm">
                        <Link href={ctaButton.url || '#'}>{ctaButton.text}</Link>
                    </ThemedButton>
                )}
                {showCart && (
                    <Button variant="outline" size="icon">
                        <ShoppingBag className="w-5 h-5" />
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
    const socialIcons: Record<string, any> = {
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
                backgroundImage: { type: 'text', label: 'Background Image URL (optional)' },
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
                }
            },
            defaultProps: {
                title: 'Welcome to Our Store',
                subtitle: 'Discover our amazing collection of products.',
                ctaText: 'Shop Now',
                ctaLink: '/products',
                align: 'center',
                padding: 'medium',
                overlay: false,
            },
            render: ({ title, subtitle, ctaText, ctaLink, align, padding, backgroundImage, overlay }) => {
                const paddingClass = {
                    small: 'py-12',
                    medium: 'py-24',
                    large: 'py-32'
                }[padding];

                return (
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
                }
            },
            defaultProps: {
                title: 'About Us',
                content: 'Write something about your brand here.',
                align: 'left'
            },
            render: ({ title, content, align }) => (
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
            )
        },
        Image: {
            label: 'Image',
            permissions: { delete: true, duplicate: true },
            fields: {
                src: { type: 'text', label: 'Image URL' },
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
                }
            },
            defaultProps: {
                src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
                alt: 'Product image',
                aspectRatio: '16/9'
            },
            render: ({ src, alt, aspectRatio, link }) => {
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
                    <section className="py-8 container px-4 md:px-6">
                        {link ? (
                            <Link href={link} className="block hover:opacity-90 transition-opacity">
                                {imageElement}
                            </Link>
                        ) : imageElement}
                    </section>
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
                }
            },
            defaultProps: {
                title: 'Featured Products',
                columns: 3,
                limit: 6,
                sortBy: 'newest',
            },
            resolveData: async ({ props }, { changed }) => {
                // This would fetch products from your database
                // For now, we'll just pass through the props
                return props;
            },
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
                }
            },
            defaultProps: {
                title: 'Why Choose Us',
                columns: 3,
                features: [
                    { title: 'Premium Quality', description: 'We use only the finest materials.', icon: 'award' },
                    { title: 'Fast Shipping', description: 'Get your order in 2-3 business days.', icon: 'truck' },
                    { title: '24/7 Support', description: 'We are here to help anytime.', icon: 'clock' }
                ]
            },
            render: ({ title, subtitle, features, columns = 3 }) => {
                const iconMap: Record<string, any> = {
                    check: Check,
                    truck: Truck,
                    shield: Shield,
                    clock: Clock,
                    zap: Zap,
                    heart: Heart,
                    award: Award
                };

                return (
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
                }[height];
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
                email: { type: 'text', label: 'Send submissions to' },
                title: { type: 'text', label: 'Form Title' },
                showPhone: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
                showMessage: { type: 'radio', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
            },
            defaultProps: {
                email: 'contact@example.com',
                title: 'Get In Touch',
                showPhone: true,
                showMessage: true,
            },
            render: ({ email, title, showPhone, showMessage }) => (
                <section className="py-8 container px-4 md:px-6">
                    <div className="p-8 border rounded-lg max-w-md mx-auto bg-card">
                        <h3 className="text-2xl font-bold mb-4">{title}</h3>
                        <div className="space-y-4">
                            <Input placeholder="Name" />
                            <Input type="email" placeholder="Email" />
                            {showPhone && <Input type="tel" placeholder="Phone" />}
                            {showMessage && <Input placeholder="Message" className="min-h-[100px]" />}
                            <Button className="w-full">Send Message</Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                            Messages will be sent to: {email}
                        </p>
                    </div>
                </section>
            )
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
                    <div className="p-4 border border-dashed rounded-lg">
                        <div className="text-xs text-muted-foreground mb-2">Custom {language.toUpperCase()} Embed</div>
                        <div dangerouslySetInnerHTML={{ __html: code }} />
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
