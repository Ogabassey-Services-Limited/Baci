'use client';

import { Truck, Globe, Calculator, MapPin } from 'lucide-react';
import React, { useState, useEffect } from 'react';

const LOAD_MESSAGES = [
    { text: 'Locating your delivery address...', icon: MapPin },
    { text: 'Checking carrier coverage...', icon: Globe },
    { text: 'Negotiating best rates...', icon: Calculator },
    { text: 'Finalizing delivery options...', icon: Truck },
];

export const SmartQuoteLoader = () => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        // Cycle messages every 2 seconds
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % LOAD_MESSAGES.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const current = LOAD_MESSAGES[index];
    const Icon = current.icon;

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative mb-4">
                {/* Spinner ring */}
                <div className="absolute inset-0 border-4 border-red-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />

                {/* Center Icon */}
                <div className="relative size-12 flex items-center justify-center bg-white rounded-full shadow-sm z-10 m-2">
                    <Icon className="text-red-600 size-6 animate-pulse" />
                </div>
            </div>

            <p className="text-sm font-medium text-gray-900 animate-in slide-in-from-bottom-2 fade-in duration-300 key={index}">
                {current.text}
            </p>
            <p className="text-xs text-gray-500 mt-1">
                Found great rates for your location
            </p>
        </div>
    );
};
