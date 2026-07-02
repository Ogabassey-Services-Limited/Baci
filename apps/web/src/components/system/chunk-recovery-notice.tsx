import type { CSSProperties } from 'react';

const containerStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  justifyContent: 'center',
  minHeight: '60vh',
  padding: '24px',
  textAlign: 'center',
};

const spinnerStyle: CSSProperties = {
  animation: 'baci-chunk-recovery-spin 0.8s linear infinite',
  border: '3px solid rgba(31, 41, 55, 0.15)',
  borderRadius: '50%',
  borderTopColor: 'rgba(31, 41, 55, 0.75)',
  height: '28px',
  width: '28px',
};

const titleStyle: CSSProperties = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 600,
  margin: 0,
};

const copyStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '14px',
  margin: 0,
};

/**
 * Shown by error boundaries while a chunk-load recovery reload is pending.
 * Styled inline on purpose: during a chunk outage the app's CSS chunks may be
 * part of what failed to load, so this component must not depend on them.
 */
export function ChunkRecoveryNotice({
  wrapInDocument = false,
}: {
  wrapInDocument?: boolean;
}) {
  const notice = (
    <div aria-live="polite" role="status" style={containerStyle}>
      <style>
        {
          '@keyframes baci-chunk-recovery-spin { to { transform: rotate(360deg); } }'
        }
      </style>
      <div aria-hidden="true" style={spinnerStyle} />
      <p style={titleStyle}>Updating to the latest version…</p>
      <p style={copyStyle}>This page is refreshing automatically.</p>
    </div>
  );

  if (!wrapInDocument) {
    return notice;
  }

  return (
    <html lang="en">
      <head>
        <title>Updating…</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
      </head>
      <body style={{ margin: 0 }}>{notice}</body>
    </html>
  );
}
