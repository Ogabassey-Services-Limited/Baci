import {
    Smartphone, Cpu, Zap,
    Utensils, Coffee, Carrot,
    Shirt, ShoppingBag, Watch,
    Home, Armchair, Lamp,
    Sparkles, Heart, Droplet,
    Palette, Scissors, Hammer,
    User, LucideIcon
} from 'lucide-react';

export type IndustryTheme = {
    id: string;
    vibe: string;
    radius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
    colors: {
        primary: string;
        accent: string;
        background: string;
        card: string;
        text: string;
    };
    layout: {
        hero: 'full' | 'split';
        categoryRail: 'circle' | 'square' | 'pill' | 'card';
        productCard: 'bordered' | 'shadow' | 'flat' | 'minimal';
    };
    icons: {
        primary: LucideIcon;
        secondary: LucideIcon;
        tertiary: LucideIcon;
    };
};

const THEMES: Record<string, IndustryTheme> = {
    ELECTRONICS: {
        id: 'electronics',
        vibe: 'Cyber/Tech',
        radius: 'sm',
        colors: {
            primary: '#000000',
            accent: '#3B82F6', // Electric Blue
            background: '#F8FAFC',
            card: '#FFFFFF',
            text: '#0F172A',
        },
        layout: {
            hero: 'full',
            categoryRail: 'square',
            productCard: 'bordered',
        },
        icons: {
            primary: Smartphone,
            secondary: Cpu,
            tertiary: Zap,
        },
    },
    FOOD_BEVERAGE: {
        id: 'food-beverage',
        vibe: 'Organic/Fresh',
        radius: '2xl',
        colors: {
            primary: '#166534', // Green
            accent: '#F97316', // Orange
            background: '#FEFCE8', // Cream
            card: '#FFFFFF',
            text: '#1C1917',
        },
        layout: {
            hero: 'split',
            categoryRail: 'circle',
            productCard: 'shadow',
        },
        icons: {
            primary: Utensils,
            secondary: Coffee,
            tertiary: Carrot,
        },
    },
    FASHION: {
        id: 'fashion',
        vibe: 'Editorial',
        radius: 'full',
        colors: {
            primary: '#171717',
            accent: '#525252',
            background: '#FFFFFF',
            card: '#FAFAFA',
            text: '#0A0A0A',
        },
        layout: {
            hero: 'full',
            categoryRail: 'pill',
            productCard: 'minimal',
        },
        icons: {
            primary: Shirt,
            secondary: ShoppingBag,
            tertiary: Watch,
        },
    },
    HOME_GOODS: {
        id: 'home-goods',
        vibe: 'Warm/Inviting',
        radius: 'lg',
        colors: {
            primary: '#78350F', // Brown
            accent: '#B45309',
            background: '#FFFBEB',
            card: '#FFFFFF',
            text: '#292524',
        },
        layout: {
            hero: 'split',
            categoryRail: 'card',
            productCard: 'flat',
        },
        icons: {
            primary: Home,
            secondary: Armchair,
            tertiary: Lamp,
        },
    },
    HEALTH_BEAUTY: {
        id: 'health-beauty',
        vibe: 'Clean/Wellness',
        radius: '2xl',
        colors: {
            primary: '#BE185D', // Pink
            accent: '#EC4899',
            background: '#FFF1F2',
            card: '#FFFFFF',
            text: '#881337',
        },
        layout: {
            hero: 'full',
            categoryRail: 'circle',
            productCard: 'shadow',
        },
        icons: {
            primary: Sparkles,
            secondary: Heart,
            tertiary: Droplet,
        },
    },
    HANDMADE: {
        id: 'handmade',
        vibe: 'Artisan',
        radius: 'md',
        colors: {
            primary: '#4338CA', // Indigo
            accent: '#6366F1',
            background: '#F5F3FF',
            card: '#FFFFFF',
            text: '#312E81',
        },
        layout: {
            hero: 'split',
            categoryRail: 'card',
            productCard: 'bordered',
        },
        icons: {
            primary: Palette,
            secondary: Scissors,
            tertiary: Hammer,
        },
    },
    HAIR_EXTENSIONS: {
        id: 'hair-extensions',
        vibe: 'Glamour',
        radius: 'sm',
        colors: {
            primary: '#000000',
            accent: '#D4AF37', // Gold
            background: '#09090B', // Dark
            card: '#18181B',
            text: '#FAFAFA', // Light text
        },
        layout: {
            hero: 'full',
            categoryRail: 'square',
            productCard: 'minimal',
        },
        icons: {
            primary: Scissors,
            secondary: Sparkles,
            tertiary: User,
        },
    },
};

const DEFAULT_THEME = THEMES.ELECTRONICS; // Fallback

export function useIndustryTheme(businessType?: string): IndustryTheme {
    if (!businessType) return DEFAULT_THEME;
    return THEMES[businessType] || DEFAULT_THEME;
}
