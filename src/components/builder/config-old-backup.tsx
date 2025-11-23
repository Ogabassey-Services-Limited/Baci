import { Config, Fields } from '@measured/puck';
import { ThemedButton } from '@/components/themed/themed-button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Star, Mail, Check, Quote, AlignJustify, Truck, Shield, Clock, Zap, Heart, Award, Search as SearchIcon, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
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

// Define the props for each component
type HeroProps = {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    align: 'left' | 'center' | 'right';
    padding: 'small' | 'medium' | 'large';
};

type HeroCarouselProps = {
    slides: {
        image: string;
        title: string;
        subtitle: string;
        ctaText: string;
        ctaLink: string;
    }[];
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
};

type ButtonProps = {
    text: string;
    link: string;
    variant: 'primary' | 'background' | 'accent';
    align: 'left' | 'center' | 'right';
};

type ProductGridProps = {
    title: string;
    columns: number;
    limit: number;
};

type TestimonialProps = {
    quote: string;
    author: string;
    role: string;
};

type FeaturesProps = {
    title: string;
    features: { title: string; description: string; icon?: string }[];
};

type NewsletterProps = {
    title: string;
    description: string;
    buttonText: string;
};

type SpacerProps = {
    height: 'small' | 'medium' | 'large';
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
    backgroundColor?: string;
    textColor?: string;
};

type HeaderProps = {
    showLogo: boolean;
    showSearch: boolean;
    showCart: boolean;
    navigationLinks: { label: string; url: string }[];
    ctaButton?: {
        text: string;
        url: string;
    };
    backgroundColor?: string;
    textColor?: string;
};

type VideoProps = { url: string; };
type MapProps = { address: string; zoom: number; };
type InstagramFeedProps = { username: string; };
type ContactFormProps = { email: string; };
type SocialIconsProps = { facebook?: string; instagram?: string; twitter?: string; };
type CodeEmbedProps = { code: string; };
type SearchProps = { placeholder: string; };

// Define the root props (page level settings)
type RootProps = {
    title: string;
};

// Metadata type for merchant context
type MetadataType = {
    merchantId?: string;
    merchant?: any;
    products?: any[];
};

// Separate component for HeroCarousel to properly use React hooks
function HeroCarouselComponent({ slides }: { slides: HeroCarouselProps['slides'] }) {
    const plugin = Autoplay({ delay: 5000, stopOnInteraction: true });

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
            components: ['Header', 'Hero', 'HeroCarousel', 'Text', 'Spacer', 'Features', 'Footer', 'Video', 'Map', 'CodeEmbed'],
        },
        media: {
            title: 'Media',
            components: ['Image', 'Testimonial', 'InstagramFeed', 'SocialIcons'],
        },
        commerce: {
            title: 'Commerce',
            components: ['ProductGrid', 'Button', 'Newsletter', 'ContactForm', 'Search'],
        },
    },
    root: {
        fields: {
            title: { type: 'text', label: 'Page Title' },
        },
        render: ({ children, title }) => {
            // Set page title if needed
            if (typeof document !== 'undefined' && title) {
                document.title = title;
            }
            return <>{children}</>;
        },
    },
    components: {
        Hero: {
            label: 'Hero Section',
            fields: {
                title: { type: 'text' },
                subtitle: { type: 'textarea' },
                ctaText: { type: 'text' },
                ctaLink: { type: 'text' },
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
                padding: 'medium'
            },
            render: ({ title, subtitle, ctaText, ctaLink, align, padding }) => {
                const paddingClass = {
                    small: 'py-12',
                    medium: 'py-24',
                    large: 'py-32'
                }[padding];

                return (
                    <section className={cn("bg-muted/30", paddingClass)}>
                        <div className={cn("container px-4 md:px-6 flex flex-col gap-4", {
                            'items-start text-left': align === 'left',
                            'items-center text-center': align === 'center',
                            'items-end text-right': align === 'right',
                        })}>
                            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">{title}</h1>
                            <p className="text-xl text-muted-foreground max-w-[700px]">{subtitle}</p>
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
            permissions: {
                delete: true,
                duplicate: true,
            },
            fields: {
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
            render: ({ slides }) => <HeroCarouselComponent slides={slides} />
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
                        <div className="prose dark:prose-invert">
                            <p>{content}</p>
                        </div>
                    </div>
                </section>
            )
        },
        Image: {
            fields: {
                src: { type: 'text', label: 'Image URL' },
                alt: { type: 'text', label: 'Alt Text' },
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
            render: ({ src, alt, aspectRatio }) => (
                <section className="py-8 container px-4 md:px-6">
                    <div
                        className="relative w-full overflow-hidden rounded-lg bg-muted"
                        style={{ aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={src}
                            alt={alt}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </section>
            )
        },
        Button: {
            fields: {
                text: { type: 'text' },
                link: { type: 'text' },
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
                align: 'center'
            },
            render: ({ text, link, variant, align }) => (
                <div className={cn("py-4 container px-4 md:px-6 flex", {
                    'justify-start': align === 'left',
                    'justify-center': align === 'center',
                    'justify-end': align === 'right',
                })}>
                    <ThemedButton colorRole={variant} asChild>
                        <Link href={link}>{text}</Link>
                    </ThemedButton>
                </div>
            )
        },
        ProductGrid: {
            fields: {
                title: { type: 'text' },
                columns: { type: 'number', min: 1, max: 4 },
                limit: { type: 'number', min: 1, max: 12 }
            },
            defaultProps: {
                title: 'Featured Products',
                columns: 3,
                limit: 6
            },
            render: (props) => <StorefrontProductGrid {...props} />
        },
        Header: {
            fields: {},
            render: () => <StorefrontHeader />
        },
        Footer: {
            render: () => <StorefrontFooter />
        },
        Testimonial: {
            fields: {
                quote: { type: 'textarea' },
                author: { type: 'text' },
                role: { type: 'text' }
            },
            defaultProps: {
                quote: "This is the best product I've ever used. Highly recommended!",
                author: "Jane Doe",
                role: "Verified Customer"
            },
            render: ({ quote, author, role }) => (
                <section className="py-12 container px-4 md:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <Quote className="w-12 h-12 mx-auto mb-6 text-muted-foreground/20" />
                        <blockquote className="text-2xl font-medium mb-6">"{quote}"</blockquote>
                        <div className="flex items-center justify-center gap-2">
                            <div className="font-semibold">{author}</div>
                            <div className="text-muted-foreground">•</div>
                            <div className="text-muted-foreground">{role}</div>
                        </div>
                        <div className="flex justify-center gap-1 mt-4 text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-current" />
                            ))}
                        </div>
                    </div>
                </section>
            )
        },
        Features: {
            fields: {
                title: { type: 'text' },
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
                features: [
                    { title: 'Premium Quality', description: 'We use only the finest materials.', icon: 'award' },
                    { title: 'Fast Shipping', description: 'Get your order in 2-3 business days.', icon: 'truck' },
                    { title: '24/7 Support', description: 'We are here to help anytime.', icon: 'clock' }
                ]
            },
            render: ({ title, features }) => {
                const iconMap = {
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
                        <h2 className="text-3xl font-bold mb-12 text-center">{title}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {features.map((feature, i) => {
                                const IconComponent = iconMap[feature.icon as keyof typeof iconMap] || Check;
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
            fields: {
                title: { type: 'text' },
                description: { type: 'textarea' },
                buttonText: { type: 'text' }
            },
            defaultProps: {
                title: 'Subscribe to our newsletter',
                description: 'Get the latest updates and offers directly in your inbox.',
                buttonText: 'Subscribe'
            },
            render: ({ title, description, buttonText }) => (
                <section className="py-16 container px-4 md:px-6">
                    <div className="bg-primary text-primary-foreground rounded-2xl p-8 md:p-12 text-center max-w-4xl mx-auto">
                        <Mail className="w-12 h-12 mx-auto mb-6 opacity-80" />
                        <h2 className="text-3xl font-bold mb-4">{title}</h2>
                        <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">{description}</p>
                        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                            <Input
                                type="email"
                                placeholder="Enter your email"
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
            fields: {
                height: {
                    type: 'select',
                    options: [
                        { label: 'Small', value: 'small' },
                        { label: 'Medium', value: 'medium' },
                        { label: 'Large', value: 'large' }
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
                    large: 'h-32'
                }[height];
                return <div className={heightClass} />;
            }
        },
        Video: {
            fields: { url: { type: 'text' } },
            defaultProps: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            render: ({ url }) => (
                <div className="aspect-video bg-muted flex items-center justify-center rounded-lg overflow-hidden border">
                    <p className="text-muted-foreground">Video Embed: {url}</p>
                </div>
            )
        },
        Map: {
            fields: { address: { type: 'text' }, zoom: { type: 'number' } },
            defaultProps: { address: 'New York, NY', zoom: 12 },
            render: ({ address }) => (
                <div className="aspect-video bg-muted flex items-center justify-center rounded-lg overflow-hidden border">
                    <p className="text-muted-foreground">Map: {address}</p>
                </div>
            )
        },
        InstagramFeed: {
            fields: { username: { type: 'text' } },
            defaultProps: { username: 'instagram' },
            render: ({ username }) => (
                <div className="p-8 bg-muted text-center rounded-lg border">
                    <p>Instagram Feed for @{username}</p>
                </div>
            )
        },
        ContactForm: {
            fields: { email: { type: 'text' } },
            defaultProps: { email: 'contact@example.com' },
            render: ({ email }) => (
                <div className="p-8 border rounded-lg max-w-md mx-auto bg-card">
                    <h3 className="text-lg font-bold mb-4">Contact Us</h3>
                    <div className="space-y-4">
                        <Input placeholder="Name" />
                        <Input placeholder="Email" />
                        <Input placeholder="Message" />
                        <Button>Send Message</Button>
                    </div>
                </div>
            )
        },
        SocialIcons: {
            fields: { facebook: { type: 'text' }, instagram: { type: 'text' }, twitter: { type: 'text' } },
            defaultProps: { facebook: '', instagram: '', twitter: '' },
            render: () => (
                <div className="flex gap-4 justify-center p-4">
                    <div className="w-8 h-8 bg-muted rounded-full" />
                    <div className="w-8 h-8 bg-muted rounded-full" />
                    <div className="w-8 h-8 bg-muted rounded-full" />
                </div>
            )
        },
        CodeEmbed: {
            fields: { code: { type: 'textarea' } },
            defaultProps: { code: '<div>Custom Code</div>' },
            render: ({ code }) => (
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                    Custom Code Embed
                </div>
            )
        },
        Search: {
            fields: { placeholder: { type: 'text' } },
            defaultProps: { placeholder: 'Search...' },
            render: ({ placeholder }) => (
                <div className="p-4">
                    <div className="relative max-w-md mx-auto">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder={placeholder} />
                    </div>
                </div>
            )
        }
    }
};
