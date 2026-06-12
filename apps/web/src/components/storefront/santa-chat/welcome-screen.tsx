'use client';

import { Mountains_of_Christmas } from 'next/font/google';
import Image from 'next/image';
import { useState, useSyncExternalStore } from 'react';

const mountainsOfChristmas = Mountains_of_Christmas({
  weight: ['400', '700'],
  subsets: ['latin'],
});

// Module-scope subscribe helper for useSyncExternalStore — stable identity so
// React never tears down / re-attaches the (no-op) listener between renders.
function subscribeToNothing(): () => void {
  return () => {
    // Intentionally empty: nothing to unsubscribe from.
  };
}

function createSnowflakes() {
  return Array.from({ length: 50 }).map(() => ({
    left: Math.random() * 100,
    fontSize: Math.random() * 1.5 + 0.5,
    duration: Math.random() * 5 + 5,
    delay: -Math.random() * 5,
  }));
}

interface WelcomeScreenProps {
  onStart: () => void;
}

/**
 * Welcome screen with falling snowflakes animation
 * Based on the original Santa-by-Ogabassey design
 */
export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  // Random snowflake geometry is generated once per mount in a lazy useState
  // initializer instead of a setState-in-effect; the hydration gate keeps the
  // server HTML (no flakes) matching the first client paint, with snow
  // appearing right after hydration exactly like the previous mount effect.
  const [generatedSnowflakes] = useState(createSnowflakes);
  const isSnowfallReady = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  const snowflakes = isSnowfallReady ? generatedSnowflakes : [];

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-red-600 text-white p-4 text-center overflow-hidden relative">
      {/* Snowflakes animation CSS — static styles, no user input */}
      <style>{`
        .snowflake {
          position: absolute;
          top: -10%;
          color: #fff;
          font-size: 1em;
          animation: fall linear infinite;
          z-index: 1;
        }
        @keyframes fall {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(105vh); opacity: 0; }
        }
      `}</style>

      {/* Falling snowflakes */}
      {snowflakes.map((flake, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Particles are not reordered
          key={`snowflake-${i}`}
          className="snowflake"
          style={{
            left: `${flake.left}vw`,
            fontSize: `${flake.fontSize}em`,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
          }}
        >
          ❄
        </div>
      ))}

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center">
        <Image
          src="/african-santa-head.svg"
          alt="Smiling Santa Claus"
          width={160}
          height={160}
          sizes="160px"
          className="mx-auto mb-6 animate-bounce"
          style={{ animationDuration: '2s' }}
        />
        <h1
          className={`text-4xl md:text-6xl mb-2 tracking-wide ${mountainsOfChristmas.className}`}
          style={{
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          Welcome to Santa&apos;s Workshop!
        </h1>
        <p
          className="max-w-md mx-auto mb-8 text-red-100"
          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
        >
          Have you been good this year? Santa is here to listen to your
          Christmas wishes. Come on in and share what you&apos;re dreaming of!
        </p>
        <button
          type="button"
          onClick={onStart}
          className="bg-white text-red-600 font-bold py-3 px-8 rounded-full text-lg shadow-xl hover:bg-red-100 transform hover:scale-105 transition-all duration-300 ease-in-out"
        >
          Chat with Santa
        </button>
      </div>
    </div>
  );
}
