import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const loadAgenticCentersData = vi.fn();

vi.mock('./data', () => ({
  loadAgenticCentersData: () => loadAgenticCentersData(),
}));

vi.mock('./client-page', () => ({
  default: () => <div>Agentic client page</div>,
}));

describe('AgenticDashboardPage', () => {
  it('loads agentic center data before rendering the client page', async () => {
    loadAgenticCentersData.mockResolvedValue({
      actionCenterState: 'ready',
      actionHealth: null,
      isPublished: false,
      trustCenterState: 'ready',
      trustReadiness: null,
    });
    const { default: AgenticDashboardPage } = await import('./page');

    render(await AgenticDashboardPage());

    expect(loadAgenticCentersData).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Agentic client page')).toBeInTheDocument();
  });
});
