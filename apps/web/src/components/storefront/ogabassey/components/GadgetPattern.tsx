import type React from 'react';

const GADGET_PATTERN_SVG = encodeURIComponent(`
<svg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'>
  <g fill='none' stroke='#ffffff' stroke-width='1.5'>
    <g transform='translate(20, 20) rotate(-15 6 10)'>
      <rect x='0' y='0' width='12' height='20' rx='2'/>
      <circle cx='6' cy='16' r='1'/>
    </g>
    <path d='M40 10 l5 5 l-5 5' stroke-width='1' opacity='0.6'/>

    <g transform='translate(120, 15) rotate(10 9 6)'>
      <rect x='0' y='0' width='18' height='12' rx='2'/>
      <line x1='4' y1='6' x2='14' y2='6' opacity='0.5'/>
    </g>
    <circle cx='100' cy='30' r='1.5' fill='#ffffff' opacity='0.6'/>

    <g transform='translate(15, 70) rotate(45)'>
      <rect x='0' y='0' width='10' height='10' rx='1'/>
    </g>
    <path d='M35 80 l10 0 m-5 -5 l0 10' stroke-width='1' opacity='0.7'/>

    <g transform='translate(120, 90) rotate(5 9 6)'>
      <rect x='0' y='3' width='18' height='12' rx='2'/>
      <circle cx='14' cy='9' r='2'/>
      <rect x='2' y='5' width='2' height='8' fill='#ffffff' opacity='0.4'/>
    </g>

    <g transform='translate(30, 120) rotate(-25 10 6)'>
      <circle cx='6' cy='6' r='2'/>
      <path d='M0 6 l-4 0 m16 0 l4 0 m-8 -8 l0 -4 m0 16 l0 4' stroke-width='1'/>
    </g>

    <g transform='translate(90, 125) rotate(15)'>
      <rect x='0' y='0' width='8' height='14' rx='1.5'/>
    </g>
    <circle cx='140' cy='70' r='2' stroke='none' fill='#ffffff'/>
    <path d='M80 50 l3 3 m-3 0 l3 -3' stroke-width='1'/>
    <circle cx='60' cy='100' r='1' fill='#ffffff' opacity='0.5'/>
  </g>
</svg>`);

/**
 * GadgetPattern
 *
 * A subtle background pattern featuring tech/gadget shapes (phones, chips, batteries).
 * Used for premium Ogabassey branding (Login, Header, Footer).
 */
export const GadgetPattern: React.FC<{
  className?: string;
  opacity?: number;
}> = ({ className = '', opacity = 0.05 }) => {
  return (
    <div
      aria-hidden="true"
      className={className}
      data-testid="ogabassey-gadget-pattern"
      style={{
        backgroundImage: `url("data:image/svg+xml,${GADGET_PATTERN_SVG}")`,
        backgroundSize: '140px 140px',
        inset: 0,
        opacity,
        pointerEvents: 'none',
        position: 'absolute',
      }}
    />
  );
};
