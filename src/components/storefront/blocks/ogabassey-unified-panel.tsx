'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { renderIcon } from '@/components/builder/icon-registry';
import { asRoute } from '@/lib/routes';

export interface OgabasseyUnifiedPanelProps {
    categories: {
        label: string;
        icon: string;
        link: string;
    }[];
    startText?: string;
    highlightText?: string;
    middleText?: string;
    endText?: string;
    endHighlightText?: string;
    circleColor?: string;
    iconColor?: string;
}

export function OgabasseyUnifiedPanel({
    categories = [
        { label: 'Phones', icon: 'smartphone', link: '/category/phones' },
        { label: 'Gaming', icon: 'gamepad', link: '/category/gaming' },
        { label: 'Accessories', icon: 'headphones', link: '/category/accessories' },
        { label: 'Printers', icon: 'printer', link: '/category/printers' },
        { label: 'Laptop', icon: 'laptop', link: '/category/laptops' },
    ],
    startText = "We Pay",
    highlightText = "YOU",
    middleText = "When",
    endText = "You Buy",
    endHighlightText = "Airtime!",
    circleColor = '#ffffff', // White background for the circle
    iconColor = '#DC2626', // Red icon
}: OgabasseyUnifiedPanelProps) {

    if (!categories || categories.length === 0) return null;

    return (
        <>
            <div className="w-full max-w-[1440px] mx-auto hidden md:block py-8 px-4">
                <div className="flex justify-between items-center w-full bg-white rounded-full shadow-sm border border-gray-100 p-4">

                    {/* Left Banner */}
                    <div className="flex items-center flex-shrink-0">
                        <span className="rounded-full font-medium capitalize bg-red-50 py-4 px-8 text-base text-gray-800 whitespace-nowrap">
                            {startText} <span className="text-red-600 font-bold">{highlightText}</span> {middleText}
                        </span>
                    </div>

                    {/* Center Icons */}
                    <div className="flex-1 px-8">
                        <div className="flex justify-around items-center w-full">
                            {categories.map((category, index) => (
                                <div
                                    key={index}
                                    className="flex flex-col items-center text-center group"
                                >
                                    <Link href={asRoute(category.link)} className="flex flex-col items-center gap-3">
                                        <div
                                            className={cn(
                                                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform group-hover:scale-110 shadow-sm hover:shadow-md border border-gray-100 group-hover:border-red-100"
                                            )}
                                            style={{ backgroundColor: circleColor }}
                                        >
                                            <div style={{ color: iconColor }}>
                                                {renderIcon(category.icon, { className: "w-8 h-8" })}
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium capitalize text-gray-700 group-hover:text-red-600 transition-colors">
                                            {category.label}
                                        </span>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Banner */}
                    <div className="flex items-center flex-shrink-0">
                        <span className="rounded-full font-medium capitalize bg-red-50 py-4 px-8 text-base text-gray-800 whitespace-nowrap">
                            {endText} <span className="text-red-600 font-bold">{endHighlightText}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Mobile View */}
            <div className="container mx-auto px-4 py-8 md:hidden">
                <div className="flex flex-col mb-4">
                    <span className="text-base font-bold">Categories</span>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                    {categories.map((category, index) => (
                        <div
                            key={index}
                            className="flex flex-col items-center text-center group"
                        >
                            <Link href={asRoute(category.link)} className="flex flex-col items-center gap-3">
                                <div
                                    className={cn(
                                        "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform shadow-sm border border-gray-100"
                                    )}
                                    style={{ backgroundColor: circleColor }}
                                >
                                    <div style={{ color: iconColor }}>
                                        {renderIcon(category.icon, { className: "w-8 h-8" })}
                                    </div>
                                </div>
                                <span className="text-xs font-medium capitalize text-gray-700">
                                    {category.label}
                                </span>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
