import type { Data } from '@puckeditor/core';
import type { Dispatch, SetStateAction } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';
import { applyTheme } from '@/lib/theme-manager';
import type { BuilderToast } from './builder-client-types';
import { getBuilderMutationErrorMessage } from './builder-descriptions';

interface RunBuilderAiCommandParams {
  command: string;
  currentConfig: Data;
  setData: Dispatch<SetStateAction<Data>>;
  setIsAiLoading: Dispatch<SetStateAction<boolean>>;
  toast: BuilderToast;
}

export async function runBuilderAiCommand(params: RunBuilderAiCommandParams) {
  const { command, currentConfig, setData, setIsAiLoading, toast } = params;

  setIsAiLoading(true);
  try {
    const response = await fetchWithCsrf('/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: command,
        currentConfig,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ details: 'Unknown error' }));
      throw new Error(errorData.details || 'Failed to process AI request');
    }

    const result = await response.json();

    if (result.config) {
      setData(result.config);
      if (result.config.theme) {
        applyTheme(result.config.theme);
      }
      toast({
        title: '✨ Design Updated',
        description: 'Gemini AI has applied your changes successfully!',
      });
    } else {
      toast({
        title: 'Warning',
        description: 'AI response was incomplete. Please try again.',
        variant: 'destructive',
      });
    }
  } catch (error) {
    console.error('Gemini AI Command Error:', error);
    toast({
      title: 'Error',
      description: getBuilderMutationErrorMessage(
        error,
        'Failed to process AI command. Please try again.'
      ),
      variant: 'destructive',
    });
  } finally {
    setIsAiLoading(false);
  }
}
