import React from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
}

interface FloatingParticlesProps {
  particles: Particle[];
}

export const FloatingParticles: React.FC<FloatingParticlesProps> = ({ particles }) => {
  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute flex items-center justify-center text-red-600 font-bold text-xl animate-float-up drop-shadow-sm select-none"
          style={{
            left: particle.x,
            top: particle.y,
          }}
        >
          +1
        </div>
      ))}
    </div>
  );
};