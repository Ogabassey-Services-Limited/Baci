import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { NewsletterComponent } from './newsletter-component';

it('keeps required description text fully opaque on the primary surface', () => {
  render(
    <NewsletterComponent
      title="Updates"
      description="Receive updates."
      buttonText="Subscribe"
      placeholder="Email"
    />
  );

  expect(screen.getByText('Receive updates.')).not.toHaveClass('opacity-90');
  expect(
    screen.getByRole('textbox', { name: 'Email address for newsletter' })
  ).toHaveClass('bg-background');
});
