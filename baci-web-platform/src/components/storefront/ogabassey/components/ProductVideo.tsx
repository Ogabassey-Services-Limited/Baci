'use client';

import React from 'react';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css';
import { Youtube } from 'lucide-react';

interface ProductVideoProps {
    videoId: string;
    title: string;
}

export const ProductVideo: React.FC<ProductVideoProps> = ({ videoId, title }) => {
    if (!videoId) return null;

    return (
        <aside aria-label="Product Video Review" className="my-12">
            <div className="flex items-center gap-2 mb-4">
                <Youtube className="text-red-600" size={20} />
                <h3 className="text-xl font-bold text-gray-900">Video Review</h3>
            </div>

            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-lg bg-gray-900">
                <LiteYouTubeEmbed
                    id={videoId}
                    title={title}
                    poster="maxresdefault"
                    webp
                />
            </div>
            <p className="text-sm text-gray-500 mt-2 text-center">
                Watch our unboxing and review of the {title}
            </p>
        </aside>
    );
};
