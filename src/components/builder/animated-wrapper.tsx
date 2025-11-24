'use client';

import { motion, useInView, Variants } from 'framer-motion';
import { useRef } from 'react';

export type AnimationType =
    | 'none'
    | 'fade-in'
    | 'slide-up'
    | 'slide-down'
    | 'slide-left'
    | 'slide-right'
    | 'zoom-in'
    | 'scale-up';

export type AnimationDuration = 'fast' | 'normal' | 'slow';

export interface AnimationConfig {
    type: AnimationType;
    duration?: AnimationDuration;
    delay?: number;
    trigger?: 'immediate' | 'scroll';
}

interface AnimatedWrapperProps {
    children: React.ReactNode;
    animation?: AnimationConfig;
    className?: string;
}

// Animation variants for different animation types
const getAnimationVariants = (type: AnimationType): Variants => {
    const variants: Record<AnimationType, Variants> = {
        'none': {
            hidden: {},
            visible: {},
        },
        'fade-in': {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
        },
        'slide-up': {
            hidden: { opacity: 0, y: 50 },
            visible: { opacity: 1, y: 0 },
        },
        'slide-down': {
            hidden: { opacity: 0, y: -50 },
            visible: { opacity: 1, y: 0 },
        },
        'slide-left': {
            hidden: { opacity: 0, x: 50 },
            visible: { opacity: 1, x: 0 },
        },
        'slide-right': {
            hidden: { opacity: 0, x: -50 },
            visible: { opacity: 1, x: 0 },
        },
        'zoom-in': {
            hidden: { opacity: 0, scale: 0.8 },
            visible: { opacity: 1, scale: 1 },
        },
        'scale-up': {
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 },
        },
    };

    return variants[type] || variants['none'];
};

// Convert duration string to milliseconds
const getDurationMs = (duration: AnimationDuration = 'normal'): number => {
    const durations: Record<AnimationDuration, number> = {
        fast: 0.2,
        normal: 0.4,
        slow: 0.6,
    };
    return durations[duration];
};

export function AnimatedWrapper({
    children,
    animation = { type: 'none', duration: 'normal', delay: 0, trigger: 'scroll' },
    className
}: AnimatedWrapperProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, {
        once: true,
        margin: '-100px',
        amount: 0.2
    });

    // If no animation, just return children
    if (!animation || animation.type === 'none') {
        return <div className={className}>{children}</div>;
    }

    const variants = getAnimationVariants(animation.type);
    const duration = getDurationMs(animation.duration);
    const delay = animation.delay || 0;

    // For scroll trigger, animate when in view
    const shouldAnimate = animation.trigger === 'scroll' ? isInView : true;

    return (
        <motion.div
            ref={ref}
            className={className}
            initial="hidden"
            animate={shouldAnimate ? 'visible' : 'hidden'}
            variants={variants}
            transition={{
                duration,
                delay,
                ease: [0.25, 0.4, 0.25, 1], // Smooth easing
            }}
        >
            {children}
        </motion.div>
    );
}
