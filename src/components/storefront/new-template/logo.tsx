import type React from 'react';

interface LogoProps {
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-8 w-auto' }) => {
    return (
        <svg
            className={className}
            viewBox="0 0 120 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <text
                x="0"
                y="28"
                fill="currentColor"
                fontSize="24"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
            >
                Ogabassey
            </text>
        </svg>
    );
};
