
import { createClient } from '@/lib/supabase/client';

export async function uploadImage(dataUri: string, bucket: string = 'images'): Promise<string | null> {
  const supabase = createClient();
  
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
