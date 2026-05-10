import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { BuilderConfigInput } from '@/schemas/builder';
import { parseBuilderConfigForAiDraft } from '@/schemas/builder';
import type { BuilderLoadResult } from './builder-route-utils';

interface AiStorefrontDraftJobRecord {
  id: string;
  merchant_id: string;
  type: string;
  status: string;
  error: string | null;
  output: unknown | null;
  result_applied_at: string | null;
}

interface AiStorefrontDraftOutput {
  generatedConfig: BuilderConfigInput;
  generatedAgainstUpdatedAt: string | null;
}

function createInternalServerErrorResponse(message = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getAiStorefrontDraftJob(
  supabase: SupabaseClient,
  merchantId: string,
  jobId: string
) {
  return supabase
    .from('ai_jobs')
    .select('id, merchant_id, type, status, error, output, result_applied_at')
    .eq('id', jobId)
    .eq('merchant_id', merchantId)
    .eq('type', 'storefront_layout_generation')
    .maybeSingle<AiStorefrontDraftJobRecord>();
}

function isAiStorefrontDraftOutput(
  value: unknown
): value is AiStorefrontDraftOutput {
  if (!value || typeof value !== 'object') return false;

  const output = value as Record<string, unknown>;
  const generatedAgainstUpdatedAt = output.generatedAgainstUpdatedAt;
  const generatedConfig = output.generatedConfig;

  return (
    generatedConfig !== null &&
    typeof generatedConfig === 'object' &&
    !Array.isArray(generatedConfig) &&
    (generatedAgainstUpdatedAt === null ||
      (typeof generatedAgainstUpdatedAt === 'string' &&
        !Number.isNaN(Date.parse(generatedAgainstUpdatedAt))))
  );
}

export async function loadAiStorefrontDraftPreview(
  supabase: SupabaseClient,
  merchantId: string,
  aiDraftJobId: string,
  canEdit: boolean
): Promise<BuilderLoadResult> {
  const { data: aiDraftJob, error: aiDraftJobError } =
    await getAiStorefrontDraftJob(supabase, merchantId, aiDraftJobId);

  if (aiDraftJobError) {
    console.error('Failed to load AI storefront draft preview:', {
      merchantId,
      aiDraftJobId,
      error: aiDraftJobError,
    });
    return {
      response: createInternalServerErrorResponse(),
    };
  }

  if (!aiDraftJob) {
    return {
      response: NextResponse.json(
        { error: 'AI storefront draft not found', code: 'job_not_found' },
        { status: 404 }
      ),
    };
  }

  if (aiDraftJob.status === 'failed') {
    return {
      response: NextResponse.json(
        {
          error: 'AI draft generation failed',
          code: 'job_failed',
          message: aiDraftJob.error ?? 'The AI draft could not be generated.',
        },
        { status: 422 }
      ),
    };
  }

  if (aiDraftJob.status !== 'completed') {
    return {
      response: NextResponse.json(
        { error: 'AI draft is still processing', code: 'job_processing' },
        { status: 409 }
      ),
    };
  }

  if (aiDraftJob.result_applied_at !== null) {
    return {
      response: NextResponse.json(
        { error: 'AI draft already applied', code: 'job_already_applied' },
        { status: 410 }
      ),
    };
  }

  const output = aiDraftJob.output;
  if (!isAiStorefrontDraftOutput(output)) {
    console.error('Invalid AI storefront draft preview payload:', {
      merchantId,
      aiDraftJobId,
    });
    return {
      response: NextResponse.json(
        { error: 'AI storefront draft is invalid' },
        { status: 422 }
      ),
    };
  }

  try {
    const generatedConfig = parseBuilderConfigForAiDraft(
      output.generatedConfig
    );

    return {
      data: {
        config: generatedConfig,
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: false,
        lastUpdated: output.generatedAgainstUpdatedAt,
        degraded: false,
        degradedReason: null,
        canEdit: false,
        previewMode: 'ai_draft',
        aiDraftJobId,
        canApplyAiDraft: canEdit,
      },
    };
  } catch (error) {
    console.error('Invalid AI storefront draft preview payload:', {
      merchantId,
      aiDraftJobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      response: NextResponse.json(
        { error: 'AI storefront draft is invalid' },
        { status: 422 }
      ),
    };
  }
}
