import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-600">
        <path d="M16 2L4 8L16 14L28 8L16 2Z" fill="currentColor" fillOpacity="0.5"/>
        <path d="M4 8V24L16 30V14L4 8Z" fill="currentColor" fillOpacity="0.8"/>
        <path d="M28 8V24L16 30V14L28 8Z" fill="currentColor"/>
      </svg>
      <span className="text-xl font-bold tracking-tight text-white hidden md:block">
        Lumina
      </span>
    </div>
  );
};