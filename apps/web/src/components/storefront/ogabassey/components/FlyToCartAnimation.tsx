'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

interface FlyToCartAnimationProps {
    startRect: DOMRect | null;
    targetId?: string;
    onComplete: () => void;
    imageSrc?: string;
}

export const FlyToCartAnimation: React.FC<FlyToCartAnimationProps> = ({
    startRect,
    targetId = 'mobile-footer-cart-icon',
    onComplete,
    imageSrc,
}) => {
    const [style, setStyle] = useState<React.CSSProperties | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (!startRect || !mounted) return;
        let completionTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const target = document.getElementById(targetId);
        if (!target) {
            console.warn(`FlyToCartAnimation: Target #${targetId} not found.`);
            onComplete();
            return;
        }

        const targetRect = target.getBoundingClientRect();

        // Initial Position
        const initialStyle: React.CSSProperties = {
            position: 'fixed',
            left: startRect.left + startRect.width / 2,
            top: startRect.top + startRect.height / 2,
            width: 40,
            height: 40,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%) scale(1)',
            opacity: 1,
            transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
            borderRadius: '50%',
            backgroundColor: '#DC2626', // Red-600
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
        };

        setStyle(initialStyle);

        // Trigger Animation Frame
        const frameId = requestAnimationFrame(() => {
            // Destination Position
            const destX = targetRect.left + targetRect.width / 2;
            const destY = targetRect.top + targetRect.height / 2;

            setStyle((prev) => ({
                ...prev,
                left: destX,
                top: destY,
                transform: 'translate(-50%, -50%) scale(0.2)',
                opacity: 0.5,
            }));

            // Cleanup after transition
            completionTimeoutId = setTimeout(() => {
                onComplete();
            }, 800);
        });

        return () => {
            cancelAnimationFrame(frameId);
            if (completionTimeoutId) {
                clearTimeout(completionTimeoutId);
            }
        };

    }, [startRect, targetId, onComplete, mounted]);

    if (!mounted || !style) return null;

    return createPortal(
        <div style={style}>
            {imageSrc ? (
                <Image src={imageSrc} alt="" fill sizes="40px" className="object-cover" />
            ) : (
                <div className="size-2 bg-white rounded-full" />
            )}
        </div>,
        document.body
    );
};
