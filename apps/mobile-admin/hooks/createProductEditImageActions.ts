import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProductEditFormData } from '@/components/product/product-edit.types';

interface CreateProductEditImageActionsParams {
  merchantId?: string;
  setFormData: Dispatch<SetStateAction<ProductEditFormData>>;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
}

export function createProductEditImageActions({
  merchantId,
  setFormData,
  setIsUploading,
}: CreateProductEditImageActionsParams) {
  const uploadImage = async (uri: string) => {
    if (!merchantId) {
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${merchantId}/products/${fileName}`;
      const fileData = new FormData();
      fileData.append('file', {
        name: fileName,
        type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        uri,
      } as unknown as Blob);

      const { error } = await supabase.storage.from('media').upload(filePath, fileData, {
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        upsert: true,
      });

      if (error) {
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('media').getPublicUrl(filePath);

      setFormData((previous) => ({
        ...previous,
        images: [...(previous.images || []), publicUrl],
      }));
    } catch (error: unknown) {
      const nextError = error as Error;
      console.error('Upload error:', nextError);
      Alert.alert('Error', nextError.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImagePick = () => {
    Alert.alert('Upload Image', 'Choose an option', [
      {
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ['images'],
            quality: 0.8,
          });

          if (!result.canceled && result.assets?.[0]) {
            await uploadImage(result.assets[0].uri);
          }
        },
        text: 'Take Photo',
      },
      {
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ['images'],
            quality: 0.8,
          });

          if (!result.canceled && result.assets?.[0]) {
            await uploadImage(result.assets[0].uri);
          }
        },
        text: 'Choose from Library',
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return {
    handleImagePick,
  };
}
