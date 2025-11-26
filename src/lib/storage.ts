
import { createClient } from '@/lib/supabase/client';

/**
 * Validates that a string is a safe data URI for image upload.
 * Prevents SSRF attacks by ensuring only data: and blob: URIs are accepted.
 */
function isValidImageUri(uri: string): boolean {
  // Allow data URIs with image MIME types
  if (uri.startsWith('data:image/')) {
    return true;
  }

  // Allow blob URIs (created locally via URL.createObjectURL)
  if (uri.startsWith('blob:')) {
    return true;
  }

  return false;
}

export async function uploadImage(dataUri: string, bucket: string = 'images'): Promise<string | null> {
  const supabase = createClient();

  // Validate the URI to prevent SSRF attacks
  if (!isValidImageUri(dataUri)) {
    throw new Error('Invalid image URI. Only data:image/* and blob: URIs are allowed.');
  }

  try {
    // Convert data URI to Blob
    const res = await fetch(dataUri);
    const blob = await res.blob();
    
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
