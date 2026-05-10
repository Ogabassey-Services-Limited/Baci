import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAiStorefrontLayout } from '@/lib/ai-storefront/normalize-ai-storefront-layout';
import { generateStorefrontLayoutWithOllama } from '@/lib/ai-storefront/ollama-storefront-client';
import type { StorefrontLayoutJobInput } from '@/schemas/ai-jobs';
import {
  type BuilderConfigInput,
  builderConfigSchema,
} from '@/schemas/builder';

export interface ProcessStorefrontLayoutJobArgs {
  supabase: SupabaseClient;
  jobId: string;
  merchantId: string;
  input: StorefrontLayoutJobInput;
}

export async function processStorefrontLayoutJob({
  supabase,
  merchantId,
  input,
}: ProcessStorefrontLayoutJobArgs) {
  const { data: pageConfig, error: pageError } = await supabase
    .from('page_configs')
    .select('id, draft_config, updated_at')
    .eq('merchant_id', merchantId)
    .eq('page_slug', input.pageSlug)
    .maybeSingle();

  if (pageError) {
    throw new Error(`Failed to load page config: ${pageError.message}`);
  }
  if (!pageConfig?.draft_config) {
    throw new Error('Starter page config is missing');
  }

  const parsedStarter = builderConfigSchema.safeParse(pageConfig.draft_config);
  if (!parsedStarter.success) {
    throw new Error('Starter page config failed validation');
  }

  const { count: productCount, error: productCountError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (productCountError) {
    throw new Error(
      `Failed to load active product count: ${productCountError.message}`
    );
  }

  const layout = await generateStorefrontLayoutWithOllama({
    businessName: input.businessName,
    businessType: input.businessType,
    brandColors: input.brandColors,
    productCount: productCount ?? 0,
  });

  const generatedConfig: BuilderConfigInput = normalizeAiStorefrontLayout({
    businessName: input.businessName,
    layout,
    starterConfig: parsedStarter.data,
  });

  const parsedGenerated = builderConfigSchema.safeParse(generatedConfig);
  if (!parsedGenerated.success) {
    throw new Error('Generated page config failed validation');
  }

  return {
    generatedConfig: parsedGenerated.data,
    designRationale: layout.designRationale ?? null,
    pageSlug: input.pageSlug,
    generatedAgainstUpdatedAt: pageConfig.updated_at,
    applied: false,
    skippedAutoApplyReason:
      pageConfig.updated_at !== input.createdPageConfigUpdatedAt
        ? 'page_config_changed_after_job_created'
        : null,
  };
}
