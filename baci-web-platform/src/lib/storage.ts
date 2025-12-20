import { createClient } from '@/lib/supabase/client';

/**
 * Parses a data URI and converts it to a Blob.
 * This avoids using fetch() on data URIs which triggers SSRF warnings in static analysis.
 */
function dataUriToBlob(dataUri: string): Blob {
  // Parse the data URI format: data:[<mediatype>][;base64],<data>
  const matches = dataUri.match(/^data:([^;,]+)?(;base64)?,(.*)$/);

  if (!matches) {
    throw new Error('Invalid data URI format');
  }

  const mimeType = matches[1] || 'application/octet-stream';
  const isBase64 = !!matches[2];
  const data = matches[3];

  // Validate it's an image MIME type
  if (!mimeType.startsWith('image/')) {
    throw new Error('Invalid data URI: must be an image type');
  }

  let byteArray: Uint8Array;

  if (isBase64) {
    // Decode base64 to binary
    const binaryString = atob(data);
    byteArray = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      byteArray[i] = binaryString.charCodeAt(i);
    }
  } else {
    // Handle URL-encoded data
    const decodedData = decodeURIComponent(data);
    byteArray = new TextEncoder().encode(decodedData);
  }

  return new Blob([byteArray as BlobPart], { type: mimeType });
}

/**
 * Converts a URI (data: or blob:) to a Blob.
 * - Data URIs: parsed directly (no network call, no SSRF risk)
 * - Blob URIs: fetched (only way to access them, safe as they're local)
 */
async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith('data:image/')) {
    // Parse data URI directly - no fetch needed, no SSRF risk
    return dataUriToBlob(uri);
  }

  if (uri.startsWith('blob:')) {
    // Blob URIs must be fetched - they're local references, safe from SSRF
    const res = await fetch(uri);
    return res.blob();
  }

  throw new Error('Invalid URI. Only data:image/* and blob: URIs are allowed.');
}

export async function uploadImage(
  dataUri: string,
  bucket: string = 'images'
): Promise<string | null> {
  const supabase = createClient();

  try {
    // Convert URI to Blob (validates URI type internally)
    const blob = await uriToBlob(dataUri);

    const fileExt = blob.type.split('/')[1] || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error processing image upload:', error);
    throw error;
  }
}
