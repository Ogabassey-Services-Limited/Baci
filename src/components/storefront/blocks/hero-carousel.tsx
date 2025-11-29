'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { asRoute } from '@/lib/routes';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

export interface HeroCarouselProps {
    slides: {
        image: string;
        title: string;
        subtitle: string;
        ctaText: string;
        ctaLink: string;
    }[];
    autoplayDelay?: number;
    height?: 'small' | 'medium' | 'large' | 'fullscreen';
}

export function HeroCarousel({
    slides,
    autoplayDelay = 5000,
    height = 'fullscreen'
}: HeroCarouselProps) {
    const plugin = useRef(Autoplay({ delay: autoplayDelay, stopOnInteraction: true }));

    const heightClasses = {
        small: 'h-[40vh]',
        medium: 'h-[60vh]',
        large: 'h-[80vh]',
        fullscreen: 'h-[85vh]' // Slightly less than 100vh to show content below
    };

    return (
        <section className={`relative w-full overflow-hidden ${heightClasses[height]}`}>
            <Carousel
                className="w-full h-full [&>div]:h-full"
                plugins={[plugin.current]}
                opts={{ loop: true, duration: 60 }}
            >
                <CarouselContent className="h-full">
                    {slides.map((slide, index) => (
                        <CarouselItem key={index} className="h-full relative">
                            {/* Background Image with Parallax-like Zoom */}
                            <div className="absolute inset-0">
                                <Image
                                    src={slide.image}
                                    alt={slide.title}
                                    fill
                                    className="object-cover transition-transform duration-[10s] hover:scale-105"
                                    priority={index === 0}
                                />
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
                            </div>

                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4 z-10">
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.8 }}
                                    viewport={{ once: true }}
                                >
                                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 drop-shadow-lg">
                                        {slide.title}
                                    </h1>
                                    <p className="text-lg md:text-2xl text-white/90 max-w-2xl mx-auto mb-8 font-light leading-relaxed">
                                        {slide.subtitle}
                                    </p>
                                    <Button asChild size="lg" className="rounded-full px-8 py-6 text-lg bg-white text-black hover:bg-white/90 hover:scale-105 transition-all duration-300 shadow-xl border-none">
                                        <Link href={asRoute(slide.ctaLink)}>{slide.ctaText}</Link>
                                    </Button>
                                </motion.div>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex bg-white/10 hover:bg-white/20 border-white/20 text-white" />
                <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex bg-white/10 hover:bg-white/20 border-white/20 text-white" />
            </Carousel>
        </section>
    );
}
