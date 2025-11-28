'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { asRoute } from '@/lib/routes';
import {
    Smartphone,
    Gamepad2,
    Headphones,
    Printer,
    Laptop,
    Watch,
    Camera,
    Tv,
    LucideIcon
} from 'lucide-react';

// Map string icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
    smartphone: Smartphone,
    gaming: Gamepad2,
    headphones: Headphones,
    printer: Printer,
    laptop: Laptop,
    watch: Watch,
    camera: Camera,
    tv: Tv,
};

export interface CategoryIconsProps {
    categories: {
        label: string;
        icon: string; // key for iconMap
        link: string;
        color?: string; // Optional custom color class
    }[];
}

export function CategoryIcons({ categories = [] }: CategoryIconsProps) {
    return (
        <section className="container mx-auto px-4 py-12">
            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                {categories.map((cat, index) => {
                    const Icon = iconMap[cat.icon.toLowerCase()] || Smartphone;

                    return (
                        <Link
                            key={index}
                            href={asRoute(cat.link)}
                            className="group flex flex-col items-center gap-3 min-w-[80px]"
                        >
                            <div className={cn(
                                "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:-translate-y-1",
                                "bg-white text-red-500 border border-neutral-100" // Default Ogabassey style
                            )}>
                                <Icon className="w-8 h-8 md:w-9 md:h-9" strokeWidth={1.5} />
                            </div>
                            <span className="text-sm font-medium text-neutral-700 group-hover:text-red-500 transition-colors">
                                {cat.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
