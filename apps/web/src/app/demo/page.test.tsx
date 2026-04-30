import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LandingPage from './page';

describe('demo LandingPage — header icon-only buttons', () => {
  it('exposes a Notifications button with an accessible name', () => {
    // Arrange
    render(<LandingPage />);

    // Act
    const button = screen.getByRole('button', { name: 'Notifications' });

    // Assert
    expect(button).toBeInTheDocument();
  });

  it('exposes a User Account button with an accessible name', () => {
    // Arrange
    render(<LandingPage />);

    // Act
    const button = screen.getByRole('button', { name: 'User Account' });

    // Assert
    expect(button).toBeInTheDocument();
  });

  it('shopping cart aria-label includes the item count and uses the plural form for zero', () => {
    // Arrange
    render(<LandingPage />);

    // Act
    const button = screen.getByRole('button', {
      name: /shopping cart/i,
    });

    // Assert — aria-label must include the count so screen readers announce
    // both the purpose and how many items are in the cart.
    expect(button).toHaveAccessibleName('Shopping Cart, 0 items');
  });

  it('renders the cart badge count visually so sighted users still see it', () => {
    // Arrange
    render(<LandingPage />);

    // Act
    const button = screen.getByRole('button', { name: /shopping cart/i });

    // Assert — the badge "0" is still in the DOM as visible text inside the
    // button (it is aria-hidden so it is not double-announced by screen readers).
    expect(button.textContent).toContain('0');
  });

  it('hides decorative icons from assistive technology', () => {
    // Arrange
    const { container } = render(<LandingPage />);

    // Act — every <svg> rendered by lucide-react inside an icon-only button
    // should carry aria-hidden so the accessible name is exactly the
    // button's aria-label, not "icon icon icon".
    const headerSvgs = container.querySelectorAll('header button svg');

    // Assert
    expect(headerSvgs.length).toBeGreaterThan(0);
    for (const svg of headerSvgs) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
