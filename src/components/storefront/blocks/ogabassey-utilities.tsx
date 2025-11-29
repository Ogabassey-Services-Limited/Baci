'use client';

// import { cn } from '@/lib/utils';
import { renderIcon } from '@/components/builder/icon-registry';
// import { Phone, Wifi, Laptop, Zap, Trophy } from 'lucide-react';

export interface OgabasseyUtilitiesProps {
    services: {
        label: string;
        icon: string;
    }[];
    startText?: string;
    highlightText?: string;
    middleText?: string;
    endText?: string;
    endHighlightText?: string;
}

export function OgabasseyUtilities({
    services = [
        { label: 'Phones', icon: 'smartphone' },
        { label: 'Gaming', icon: 'gamepad' },
        { label: 'Accessories', icon: 'headphones' },
        { label: 'Printers', icon: 'printer' },
        { label: 'Laptop', icon: 'laptop' },
    ],
    startText = "We Pay",
    highlightText = "YOU",
    middleText = "When",
    endText = "You Buy",
    endHighlightText = "Airtime!",
}: OgabasseyUtilitiesProps) {

    return (
        <div className="w-full max-w-[1440px] mx-auto hidden md:block py-8 px-4">
            <div className="flex justify-between items-center w-full bg-white rounded-full shadow-sm border border-gray-100 p-2">

                {/* Left Banner */}
                <div className="flex items-center">
                    <span className="rounded-full font-medium capitalize bg-red-50 py-3 px-8 text-sm text-gray-800">
                        {startText} <span className="text-red-600 font-bold">{highlightText}</span> {middleText}
                    </span>
                </div>

                {/* Center Icons */}
                <div className="flex-1 px-8">
                    <div className="flex justify-around items-center w-full">
                        {services.map((service, index) => (
                            <div key={index} className="flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="text-red-500 group-hover:scale-110 transition-transform duration-300">
                                    {renderIcon(service.icon, { className: "w-6 h-6" })}
                                </div>
                                <span className="text-xs font-medium capitalize text-gray-600 group-hover:text-red-600 transition-colors">
                                    {service.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Banner */}
                <div className="flex items-center">
                    <span className="rounded-full font-medium capitalize bg-red-50 py-3 px-8 text-sm text-gray-800">
                        {endText} <span className="text-red-600 font-bold">{endHighlightText}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
