import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const BUCKET_ID = 'media';

/** Minimum bytes needed for reliable image format detection */
const MAGIC_BYTE_SAMPLE_SIZE = 4100;

/**
 * Check if the first bytes of a file match a known image format.
 *
 * Supported formats: JPEG, PNG, GIF, WebP, AVIF
 * Returns the detected MIME type or null if unrecognized.
 */
function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: 47 49 46 38 (GIF8)
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // AVIF: ....ftyp at offset 4 (ISO BMFF container)
  // Then check for 'avif' or 'avis' brand at offset 8
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    // Read the major brand (4 bytes at offset 8)
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return 'image/avif';
    }
  }

  return null;
}

interface StorageObjectRecord {
  id: string;
  bucket_id: string;
  name: string;
  metadata: Record<string, string> | null;
}

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: StorageObjectRecord;
  schema: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload: WebhookPayload = await req.json();
    const { record } = payload;

    // Only process media bucket uploads
    if (record.bucket_id !== BUCKET_ID) {
      return new Response(
        JSON.stringify({ message: 'Skipped: wrong bucket' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Only process blog image paths: {merchant_id}/blog/{filename}
    const pathParts = record.name.split('/');
    if (pathParts.length !== 3 || pathParts[1] !== 'blog') {
      return new Response(
        JSON.stringify({ message: 'Skipped: not a blog image path' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const filePath = record.name;
    console.log(`Validating magic bytes for: ${filePath}`);

    // Initialize Supabase Admin Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create a short-lived signed URL for downloading the file header
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage.from(BUCKET_ID).createSignedUrl(filePath, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      // File may not exist yet (rolled-back RLS test INSERT) — not an error
      console.log(
        `Could not create signed URL for ${filePath}: ${signedUrlError?.message || 'no data'}`
      );
      return new Response(
        JSON.stringify({ message: 'Skipped: file not accessible' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch only the first bytes using HTTP Range header
    const response = await fetch(signedUrlData.signedUrl, {
      headers: { Range: `bytes=0-${MAGIC_BYTE_SAMPLE_SIZE - 1}` },
    });

    if (!response.ok && response.status !== 206) {
      console.error(
        `Failed to fetch file header for ${filePath}: ${response.status}`
      );
      return new Response(
        JSON.stringify({ message: 'Failed to fetch file header' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const detectedMime = detectImageMime(bytes);

    if (detectedMime) {
      console.log(`Valid image: ${filePath} (detected: ${detectedMime})`);
      return new Response(JSON.stringify({ valid: true, detectedMime }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Invalid file — delete it
    console.warn(
      `Invalid file detected, deleting: ${filePath} (no valid image magic bytes found)`
    );

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_ID)
      .remove([filePath]);

    if (deleteError) {
      console.error(`Failed to delete invalid file ${filePath}:`, deleteError);
    }

    return new Response(
      JSON.stringify({
        valid: false,
        message: `Deleted invalid file: ${filePath}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in validate-media-upload:', error);
    // Fail open: don't block uploads if validation fails
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
