import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export const SnowEffect: React.FC = () => {
  const { theme } = useTheme();

  if (theme !== 'santa') return null;

  // Create an array of snowflakes with random properties
  const snowflakes = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    animationDuration: `${Math.random() * 3 + 5}s`,
    animationDelay: `${Math.random() * 5}s`,
    opacity: Math.random(),
    size: `${Math.random() * 5 + 3}px`
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute top-[-10px] bg-white rounded-full snowflake"
          style={{
            left: flake.left,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            animation: `snowfall ${flake.animationDuration} linear infinite`,
            animationDelay: flake.animationDelay,
            boxShadow: '0 0 5px rgba(255,255,255,0.8)'
          }}
        />
      ))}
      {/* Festive Top Decoration - Hanging Lights Overlay */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-green-600 to-red-600 opacity-20 blur-xl"></div>
    </div>
  );
};