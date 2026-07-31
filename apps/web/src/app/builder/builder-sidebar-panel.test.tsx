import './builder-client.test-support';
import type { Data } from '@puckeditor/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderSidebarPanel } from './builder-sidebar-panel';

describe('BuilderSidebarPanel', () => {
  it('renders the configured builder tools', () => {
    render(
      <BuilderSidebarPanel
        canEdit={true}
        data={{ content: [], root: {}, zones: {} } as Data}
        isAiLoading={false}
        onAiCommand={vi.fn()}
        onSeoChange={vi.fn()}
        onSetupChange={vi.fn()}
        onStoreChange={vi.fn()}
        onThemeChange={vi.fn()}
        seoData={{
          title: '',
          description: '',
          keywords: '',
          twitterCard: 'summary_large_image',
        }}
        setupSettings={{} as never}
        storeSettings={{} as never}
      />
    );

    expect(screen.getByText('Gemini AI Assistant')).toBeInTheDocument();
    expect(screen.getByTestId('puck-components')).toBeInTheDocument();
  });
});
