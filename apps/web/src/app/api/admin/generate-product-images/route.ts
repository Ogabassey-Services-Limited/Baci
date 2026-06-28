import { generateText } from 'ai';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { activeImageModel } from '@/ai/provider';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';

interface GeminiAIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data: string;
          mimeType: string;
        };
      }>;
    };
  }>;
}

import { createClient } from '@/lib/supabase/server';

// Configure process limit to avoid timeouts
const BATCH_SIZE = 3;
const TARGET_IMAGE_COUNT = 4;

export const maxDuration = 60; // Allow 60 seconds for execution

export async function POST(req: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(req);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Check Authentication (Admin Only)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Admin routes require being the merchant owner, not staff
    if (merchantContext.staffAccess.isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // RBAC: Only platform admins can trigger AI image generation
    const { data: adminCheck } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('id', merchantId)
      .maybeSingle();

    if (!adminCheck?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch products that need images
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parent_product_id');

    // Start building the query
    let query = supabase
      .from('products')
      .select('id, name, color, images, parent_product_id')
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    // If parentId is provided, target specifically those variants
    if (parentId) {
      query = query.eq('parent_product_id', parentId);
    } else {
      // General clean-up mode: avoid touching empty products unless specified
      query = query.not('images', 'is', null);
    }

    const { data: products, error: dbError } = await query.limit(10); // Fetch a few

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const processed: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];

    // Filter locally
    const candidates = (products || [])
      .filter((p) => {
        const imgCount = Array.isArray(p.images) ? p.images.length : 0;
        // If parentId is set, we allow starting from 0 images.
        // Otherwise, we enforce strict mode to only fill gaps for valid products.
        const allowZero = !!parentId;
        return imgCount < TARGET_IMAGE_COUNT && (allowZero || imgCount > 0);
      })
      .slice(0, BATCH_SIZE);

    if (candidates.length === 0) {
      return NextResponse.json({
        message: 'No eligible products found needing images.',
      });
    }

    // 3. Process candidates
    for (const product of candidates) {
      try {
        const currentImages = Array.isArray(product.images)
          ? product.images
          : [];
        const missingCount = TARGET_IMAGE_COUNT - currentImages.length;

        // Only generate 1 per run per product to be safe and fast
        if (missingCount > 0) {
          const prompt = `Professional product photography of ${product.name} ${product.color ? `in ${product.color} color` : ''}, minimalist style, photorealistic, 4k resolution, white or light gray background, advertising quality.`;

          console.log(`Generating image for ${product.name}...`);

          // Use generateText with image modality for Gemini models
          const { response } = await generateText({
            model: activeImageModel,
            prompt: prompt,
            providerOptions: {
              google: {
                responseModalities: ['IMAGE'],
              },
            },
          });

          const body = response.body as unknown as GeminiAIResponse;
          const content = body?.candidates?.[0]?.content;
          const parts = content?.parts || [];
          const imagePart = parts.find((p) => p.inlineData);

          let base64Data = null;
          let contentType = 'image/png';

          if (imagePart?.inlineData) {
            base64Data = imagePart.inlineData.data;
            contentType = imagePart.inlineData.mimeType || 'image/png';
          } else {
            console.warn(
              'No image data found in response parts',
              JSON.stringify(response.body)
            );
          }

          if (!base64Data) {
            throw new Error('No image data returned from AI');
          }

          // Convert base64 to buffer
          const buffer = Buffer.from(base64Data, 'base64');

          // Generate unique filename
          const timestamp = Date.now();
          const filename = `${product.id}/gen_${timestamp}.png`;

          // 4. Upload to Supabase Storage
          const { data: _uploadData, error: uploadError } =
            await supabase.storage.from('images').upload(filename, buffer, {
              contentType,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // 5. Get Public URL
          const {
            data: { publicUrl },
          } = supabase.storage.from('images').getPublicUrl(filename);

          // 6. Update Product Record
          const newImages = [...currentImages, publicUrl];

          const { error: updateError } = await supabase
            .from('products')
            .update({ images: newImages })
            .eq('id', product.id)
            .eq('merchant_id', merchantId);

          if (updateError) throw updateError;

          processed.push({
            id: product.id,
            name: product.name,
            new_image: publicUrl,
          });
        }
      } catch (err: unknown) {
        console.error(`Failed to process ${product.id}:`, err);
        errors.push({ id: product.id, error: (err as Error).message });
      }
    }

    return NextResponse.json({
      success: true,
      processed_count: processed.length,
      processed,
      errors,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
