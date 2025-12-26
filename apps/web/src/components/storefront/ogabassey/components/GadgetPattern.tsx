import React from 'react';

/**
 * GadgetPattern
 * 
 * A subtle background pattern featuring tech/gadget shapes (phones, chips, batteries).
 * Used for premium Ogabassey branding (Login, Header, Footer).
 */
export const GadgetPattern: React.FC<{ className?: string; opacity?: number }> = ({
    className = '',
    opacity = 0.05
}) => {
    // SVG pattern encoded as data URI
    const requestSvg = encodeURIComponent(`
<svg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'>
  <g fill='none' stroke='#ffffff' stroke-width='1.5'>
    <g transform='translate(20, 20) rotate(-15 6 10)'>
      <rect x='0' y='0' width='12' height='20' rx='2'/>
    </g>
    <g transform='translate(120, 90) rotate(5 9 6)'>
      <rect x='0' y='3' width='18' height='12' rx='2'/>
    </g>
    <g transform='translate(70, 50) rotate(-25 10 6)'>
      <circle cx='6' cy='6' r='2'/>
    </g>
    <circle cx='140' cy='20' r='2' stroke='none' fill='#ffffff'/>
    <path d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/>
  </g>
</svg>`);

    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{
                backgroundImage: `url("data:image/svg+xml,${requestSvg}")`,
                backgroundSize: '140px 140px',
                opacity: opacity,
            }}
        />
    );
};
