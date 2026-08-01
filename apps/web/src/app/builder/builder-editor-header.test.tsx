import './builder-client.test-support';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderEditorHeader } from './builder-editor-header';

describe('BuilderEditorHeader', () => {
  it('runs save and publish actions in editable mode', () => {
    const onSave = vi.fn();
    const onPublish = vi.fn();
    render(
      <BuilderEditorHeader
        applyingAiDraft={false}
        canApplyAiDraft={false}
        canEdit={true}
        isAiDraftPreview={false}
        onApplyAiDraft={vi.fn()}
        onPublish={onPublish}
        onSave={onSave}
        publishing={false}
        saving={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onPublish).toHaveBeenCalledOnce();
  });
});
