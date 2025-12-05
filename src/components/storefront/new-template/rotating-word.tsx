import React, { useState, useEffect } from 'react';

const WORDS = ['Phones', 'Laptops', 'Games', 'Gadgets'];

export const RotatingWord: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-red-600 font-bold inline-block min-w-[80px] text-left transition-all duration-300">
      {WORDS[index]}
    </span>
  );
};
