import React from 'react';

interface LogoProps {
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <div className={`font-bold text-2xl tracking-tight ${className ?? ''}`}>
            <span className="text-gray-900">Oga</span>
            <span className="text-red-600">bassey</span>
        </div>
    );
};
