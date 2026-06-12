import 'server-only';

import { generateText } from 'ai';
import { cookies } from 'next/headers';
import { activeImageModel } from '@/ai/provider';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

// Style mapping based on business category
const CATEGORY_STYLES: Readonly<Record<string, string>> = Object.freeze({
  fashion: 'elegant',
  electronics: 'tech',
  'hair-extensions': 'luxury',
  'home-goods': 'minimal',
  'health-beauty': 'organic',
  handmade: 'vibrant',
  'food-beverage': 'organic',
  other: 'modern',
});

// Image generation prompts per category
const CATEGORY_PROMPTS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    fashion: Object.freeze([
      'Professional fashion boutique interior with elegant clothing displays, soft lighting, modern aesthetic, high-end retail environment',
      'Fashion runway editorial style photo, stylish models, contemporary design, vibrant colors, professional photography',
      'Minimalist fashion store with curated clothing collection, clean lines, sophisticated ambiance, luxury retail',
    ]),
    electronics: Object.freeze([
      'Modern tech workspace with sleek gadgets, futuristic aesthetic, clean desk setup, premium electronics',
      'High-tech gadgets flat lay, modern devices, minimalist composition, professional product photography',
      'Contemporary electronics store interior, digital displays, cutting-edge technology, vibrant blue lighting',
    ]),
    'hair-extensions': Object.freeze([
      'Luxury hair salon interior with glamorous styling stations, elegant mirrors, premium beauty environment',
      'Professional hair bundles display, various textures and colors, luxury presentation, high-quality photography',
      'Elegant beauty salon aesthetic, sophisticated hair styling area, luxurious atmosphere, modern design',
    ]),
    'home-goods': Object.freeze([
      'Beautiful modern living room interior, minimalist decor, cozy atmosphere, natural lighting, elegant furniture',
      'Styled home decor shelf with curated accessories, plants, candles, warm aesthetic, professional interior design',
      'Contemporary bedroom with elegant furnishings, soft textiles, calming color palette, sophisticated design',
    ]),
    'health-beauty': Object.freeze([
      'Spa wellness aesthetic with skincare products, natural ingredients, serene atmosphere, organic beauty',
      'Skincare flat lay with elegant bottles and jars, clean background, professional product photography',
      'Beauty products arrangement on marble surface, soft lighting, luxurious presentation, organic aesthetic',
    ]),
    handmade: Object.freeze([
      'Artisan workshop with handcrafted items, creative workspace, authentic craftsmanship, warm natural lighting',
      'Handmade crafts display on wooden surface, artisanal products, rustic aesthetic, vibrant colors',
      'Craft materials flat lay with natural textures, colorful threads, artistic composition, authentic handmade feel',
    ]),
    'food-beverage': Object.freeze([
      'Beautifully plated gourmet food on elegant table setting, professional food photography, vibrant colors',
      'Fresh organic ingredients spread on wooden surface, farmers market aesthetic, natural lighting',
      'Cozy cafe interior with artisanal coffee, warm atmosphere, rustic decor, inviting ambiance',
    ]),
    other: Object.freeze([
      'Modern minimalist retail store interior, clean design, professional lighting, contemporary aesthetic',
      'Product display shelf with curated items, organized presentation, professional commercial photography',
      'Contemporary business storefront, elegant design, welcoming atmosphere, professional environment',
    ]),
  });

/**
 * Generate a batch of hero images for a specific category
 * NOTE: Image generation temporarily uses placeholder URLs until AI SDK is configured
 */
export async function generateHeroImageBatch(
  category: string,
  count: number = 10
): Promise<{ success: boolean; imageIds?: string[]; error?: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const style = CATEGORY_STYLES[category] || 'modern';
    const prompts = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.other;

    const generatedImages: Array<{
      image_url: string;
      image_prompt: string;
      category: string;
      style_variant: string;
    }> = [];

    logger.info({
      message: `Generating ${count} hero images for category: ${category}`,
    });

    // Generate images in batches of 3 (using the 3 prompts)
    const batchesNeeded = Math.ceil(count / prompts.length);

    for (
      let batch = 0;
      batch < batchesNeeded && generatedImages.length < count;
      batch++
    ) {
      for (const basePrompt of prompts) {
        if (generatedImages.length >= count) break;

        // Add variation to the prompt for uniqueness
        const variation = batch > 0 ? `, variation ${batch + 1}` : '';
        const fullPrompt = `${basePrompt}${variation}. Professional e-commerce hero banner image, wide landscape format, 16:9 aspect ratio, high quality, suitable for online store`;

        try {
          // Use Gemini 2.5 Flash with image generation capabilities
          const { files } = await generateText({
            model: activeImageModel,
            providerOptions: {
              google: {
                responseModalities: ['TEXT', 'IMAGE'],
              },
            },
            prompt: `Generate a professional hero banner image for an e-commerce website. ${fullPrompt}`,
          });

          // Extract the generated image from the response
          if (!files || files.length === 0) {
            logger.warn({ message: 'No image generated in response' });
            continue;
          }

          const imageFile = files[0];
          if (!imageFile.base64) {
            logger.warn({ message: 'Image file has no base64 data' });
            continue;
          }

          // Convert image to base64 data URI
          const base64Image = imageFile.base64;

          // Upload to Supabase Storage
          const fileName = `hero-${category}-${Date.now()}-${crypto.randomUUID()}.png`;
          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from('hero-images')
              .upload(fileName, Buffer.from(base64Image, 'base64'), {
                contentType: 'image/png',
                cacheControl: '31536000', // 1 year cache
              });

          if (uploadError) {
            logger.error({
              message: 'Failed to upload hero image to storage',
              error: uploadError,
            });
            continue;
          }

          // Get public URL
          const {
            data: { publicUrl },
          } = supabase.storage
            .from('hero-images')
            .getPublicUrl(uploadData.path);

          generatedImages.push({
            image_url: publicUrl,
            image_prompt: fullPrompt,
            category,
            style_variant: style,
          });

          logger.info({
            message: `Generated hero image ${generatedImages.length}/${count}`,
            url: publicUrl,
          });
        } catch (imageError) {
          logger.error({
            message: 'Failed to generate individual hero image',
            error: imageError,
          });
          // Continue to next image
        }
      }
    }

    if (generatedImages.length === 0) {
      return { success: false, error: 'Failed to generate any images' };
    }

    // Insert into database
    const { data: insertedImages, error: insertError } = await supabase
      .from('ai_hero_images')
      .insert(generatedImages)
      .select('id');

    if (insertError) {
      logger.error({
        message: 'Failed to insert hero images into database',
        error: insertError,
      });
      return { success: false, error: insertError.message };
    }

    const imageIds = insertedImages.map((img: { id: string }) => img.id);

    logger.info({
      message: 'Successfully generated and stored hero images',
      category,
      count: imageIds.length,
    });

    return { success: true, imageIds };
  } catch (error) {
    logger.error({ message: 'Hero image batch generation failed', error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Assign hero images to a merchant using deterministic round-robin
 */
export async function assignHeroImagesToMerchant(
  merchantId: string,
  category: string,
  autoGenerate: boolean = true
): Promise<{ success: boolean; imageIds?: string[]; error?: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get 3 least-used images for this category (deterministic)
    const { data: images, error: fetchError } = await supabase
      .from('ai_hero_images')
      .select('id, usage_count')
      .eq('category', category)
      .eq('is_active', true)
      .order('usage_count', { ascending: true })
      .order('created_at', { ascending: true }) // Secondary sort for deterministic behavior
      .limit(3);

    if (fetchError || !images || images.length === 0) {
      if (!autoGenerate) {
        logger.info({
          message:
            'No hero images available, skipping generation (autoGenerate=false)',
          category,
        });
        // Return success but with no images (will use placeholders)
        return { success: true, imageIds: [] };
      }

      logger.warn({
        message: 'No hero images available, generating new batch',
        category,
      });

      // Generate a new batch
      const generateResult = await generateHeroImageBatch(category, 10);
      if (!generateResult.success) {
        return { success: false, error: 'Failed to generate hero images' };
      }

      // Retry fetching
      const { data: retryImages, error: retryError } = await supabase
        .from('ai_hero_images')
        .select('id, usage_count')
        .eq('category', category)
        .eq('is_active', true)
        .order('usage_count', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(3);

      if (retryError || !retryImages || retryImages.length < 3) {
        return { success: false, error: 'Failed to fetch generated images' };
      }

      const imageIds = retryImages.map((img: { id: string }) => img.id);

      // FIXED: Increment usage count for each image atomically
      // Note: Supabase doesn't support SQL expressions in .update()
      // Using database RPC for atomic operation
      for (const imageId of imageIds) {
        await supabase.rpc('increment_hero_image_usage', { image_id: imageId });
      }

      // Update merchant
      await supabase
        .from('merchants')
        .update({
          hero_image_ids: imageIds,
          hero_images_generated_at: new Date().toISOString(),
        })
        .eq('id', merchantId);

      return { success: true, imageIds };
    }

    const imageIds = images.map((img: { id: string }) => img.id);

    // FIXED: Increment usage count atomically (was N+1 query pattern)
    // Using RPC function for atomic increment
    for (const imageId of imageIds) {
      await supabase.rpc('increment_hero_image_usage', { image_id: imageId });
    }

    // Update merchant with assigned image IDs
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        hero_image_ids: imageIds,
        hero_images_generated_at: new Date().toISOString(),
      })
      .eq('id', merchantId);

    if (updateError) {
      logger.error({
        message: 'Failed to update merchant with hero images',
        error: updateError,
      });
      return { success: false, error: updateError.message };
    }

    logger.info({
      message: 'Successfully assigned hero images to merchant',
      merchantId,
      imageIds,
    });

    return { success: true, imageIds };
  } catch (error) {
    logger.error({ message: 'Hero image assignment failed', error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Regenerate hero images for a merchant (premium feature)
 */
export async function regenerateHeroImagesForMerchant(
  merchantId: string
): Promise<{ success: boolean; imageIds?: string[]; error?: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant's business type
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('business_type, hero_image_ids, hero_images_regeneration_count')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return { success: false, error: 'Merchant not found' };
    }

    // TODO: Check if merchant has premium subscription/feature flag
    // For now, allow regeneration

    const category = merchant.business_type?.toLowerCase() || 'other';

    // Decrement usage count of old images
    if (merchant.hero_image_ids && merchant.hero_image_ids.length > 0) {
      for (const oldImageId of merchant.hero_image_ids) {
        const { data: currentImage } = await supabase
          .from('ai_hero_images')
          .select('usage_count')
          .eq('id', oldImageId)
          .single();

        if (currentImage) {
          const newCount = Math.max((currentImage.usage_count || 0) - 1, 0);
          await supabase
            .from('ai_hero_images')
            .update({ usage_count: newCount })
            .eq('id', oldImageId);
        }
      }
    }

    // Assign new images
    const assignResult = await assignHeroImagesToMerchant(merchantId, category);

    if (assignResult.success) {
      // Increment regeneration count
      await supabase
        .from('merchants')
        .update({
          hero_images_regeneration_count:
            (merchant.hero_images_regeneration_count || 0) + 1,
        })
        .eq('id', merchantId);
    }

    return assignResult;
  } catch (error) {
    logger.error({ message: 'Hero image regeneration failed', error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
