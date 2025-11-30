"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, InputProps } from "@/components/ui/input";
import { useEffect, useState } from "react";

interface TypingPlaceholderInputProps extends InputProps {
    placeholders: string[];
    typingSpeed?: number;
    deletingSpeed?: number;
    delayBeforeDelete?: number;
    delayBeforeNext?: number;
    staticPrefix?: string;
}

export const TypingPlaceholderInput = React.forwardRef<HTMLInputElement, TypingPlaceholderInputProps>(
    ({ className, placeholders, typingSpeed = 100, deletingSpeed = 50, delayBeforeDelete = 2000, delayBeforeNext: _delayBeforeNext = 500, staticPrefix = "", ...props }, ref) => {
        const [placeholder, setPlaceholder] = useState(staticPrefix);
        const [wordIndex, setWordIndex] = useState(0);
        const [isDeleting, setIsDeleting] = useState(false);
        const [text, setText] = useState("");
        const [hasStoppedPermanently, setHasStoppedPermanently] = useState(false);

        useEffect(() => {
            if (hasStoppedPermanently) return;

            const currentWord = placeholders[wordIndex % placeholders.length];

            const timer = setTimeout(() => {
                if (isDeleting) {
                    setText(currentWord.substring(0, text.length - 1));
                    if (text.length === 0) {
                        setIsDeleting(false);
                        setWordIndex((prev) => prev + 1);
                    }
                } else {
                    setText(currentWord.substring(0, text.length + 1));
                    if (text.length === currentWord.length) {
                        // Wait before deleting
                        setTimeout(() => setIsDeleting(true), delayBeforeDelete);
                        return;
                    }
                }
            }, isDeleting ? deletingSpeed : typingSpeed);

            return () => clearTimeout(timer);
        }, [text, isDeleting, wordIndex, placeholders, typingSpeed, deletingSpeed, delayBeforeDelete, hasStoppedPermanently]);

        // Update the placeholder while animating
        useEffect(() => {
            if (!hasStoppedPermanently) {
                setPlaceholder(staticPrefix + text);
            }
        }, [text, staticPrefix, hasStoppedPermanently]);

        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            setHasStoppedPermanently(true);
            setPlaceholder(""); // Clear on focus
            props.onFocus?.(e);
        };

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            // On blur, show static placeholder (first option) if empty
            // We rely on the input's own value for the actual text, 
            // this is just the placeholder text reappearing if the user left it empty.
            if (placeholders.length > 0) {
                setPlaceholder(staticPrefix + placeholders[0]);
            }
            props.onBlur?.(e);
        };

        return (
            <Input
                {...props}
                ref={ref}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={cn("placeholder:text-muted-foreground transition-all duration-300 focus:placeholder:text-accent", className)}
            />
        );
    }
);

TypingPlaceholderInput.displayName = "TypingPlaceholderInput";
