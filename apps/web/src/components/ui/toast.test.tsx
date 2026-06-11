import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, ToastViewport } from './toast';

function getToastViewport() {
  const notificationsRegion = screen.getByRole('region', {
    name: /notifications/i,
  });
  return within(notificationsRegion).getByRole('list');
}

describe('ToastViewport', () => {
  it('stays out of document flow before utility CSS loads', () => {
    render(
      <ToastProvider>
        <ToastViewport />
      </ToastProvider>
    );

    expect(getToastViewport()).toHaveStyle({
      margin: '0',
      position: 'fixed',
    });
  });

  it('preserves caller styles over viewport layout defaults', () => {
    render(
      <ToastProvider>
        <ToastViewport
          style={{
            backgroundColor: 'red',
            margin: '10px',
          }}
        />
      </ToastProvider>
    );

    expect(getToastViewport()).toHaveStyle(
      'background-color: rgb(255, 0, 0); margin: 10px; position: fixed'
    );
  });

  it('prevents callers from overriding the fixed-position CLS guard', () => {
    render(
      <ToastProvider>
        <ToastViewport style={{ position: 'absolute' }} />
      </ToastProvider>
    );

    expect(getToastViewport()).toHaveStyle({
      position: 'fixed',
    });
  });
});
