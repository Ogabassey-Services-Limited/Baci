import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderPreview } from './onboarding-preview/onboarding-preview.test-support';

it('renders the deterministic preview content from its public component', async () => {
  renderPreview({ businessName: 'North Star' });

  expect(await screen.findByTestId('puck-render')).toHaveTextContent(
    'North Star'
  );
});
