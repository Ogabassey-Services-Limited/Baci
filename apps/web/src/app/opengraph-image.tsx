import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Baci - Create your e-commerce store in seconds with AI';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background:
          'linear-gradient(135deg, #23205d 0%, #3d3a8c 50%, #23205d 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px',
      }}
    >
      {/* Logo/Icon Area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '40px',
        }}
      >
        {/* Shopping Bag Icon */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 200 250"
          fill="none"
          style={{ marginRight: '20px' }}
          role="img"
          aria-labelledby="baci-logo-title"
        >
          <title id="baci-logo-title">Baci shopping bag logo</title>
          <path
            d="M180 209c-1.5-10-2.7-20-4-30-1.5-12-2.8-24-4.3-36-1.1-9-2.6-18-3.4-27l-1.6-10c-.9-8-1.6-15-2.5-22-.6-4.5-2.7-6.2-7.3-6.3-6-.04-12-.08-18 .03-2.4.03-3.3-.8-3.5-3.3a40 40 0 00-1.8-10c-5.4-15.7-16.1-22.3-30.3-23-16.1-.7-31.9 14.8-32.7 31-.3 5.4-.3 5.5-5.9 5.4-5.1-.1-10.3-.1-15.4-.2-3.5-.05-6 1.3-6.6 5-1.2 7.8-2.4 15.6-3.4 23.4a3050 3050 0 00-3.8 30.4c-2.2 19.3-6.4 57-6.4 57s-1.3 10.4-1.6 11.2c-3.6 9.4 1.5 16.8 11.5 16.8 19-.01 38-.17 57-.18 24.4-.02 48.9.15 73.3.02 5.6-.03 11.5-4.7 10.4-11.7z"
            fill="#23255d"
          />
          <path
            d="M92 131c1.1-12.2 12-20.2 22.5-13.3 5.7-10.2 14.4-15.8 26.2-14.5 13.4 1.5 19.8 11 23.5 23 11.7-.6 19.5 4.5 23 15.6 2.3 7.4-.7 16.6-7.5 21.5-8.7 6.3-17.6 5.7-26-.7-18.3 16-29.7 15.8-46.5-.9-7.2 6-14.8 6.8-22.7 1.2-6-4.3-8.1-10.5-7.2-17.5a15.3 15.3 0 016.9-11.4 25 25 0 017.8-3z"
            fill="#fff"
          />
        </svg>
        {/* Baci Text */}
        <div
          style={{
            fontSize: '96px',
            fontWeight: 'bold',
            color: '#ffffff',
            letterSpacing: '-2px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Baci
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#f0bf58',
              marginLeft: '8px',
              marginTop: '-50px',
            }}
          />
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: '36px',
          color: '#ffffff',
          textAlign: 'center',
          maxWidth: '900px',
          lineHeight: 1.4,
          opacity: 0.95,
        }}
      >
        Create your e-commerce store in seconds with AI
      </div>

      {/* Subtext */}
      <div
        style={{
          fontSize: '24px',
          color: '#f0bf58',
          marginTop: '24px',
          fontWeight: '600',
        }}
      >
        Your business, live in 3 minutes
      </div>

      {/* Bottom decorative elements */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          display: 'flex',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#f0bf58',
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#f0bf58',
            opacity: 0.7,
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#f0bf58',
            opacity: 0.4,
          }}
        />
      </div>
    </div>,
    {
      ...size,
    }
  );
}
