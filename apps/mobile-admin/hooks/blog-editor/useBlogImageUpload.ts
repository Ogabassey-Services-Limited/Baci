import * as ImagePicker from 'expo-image-picker';
import { type RefObject, useState } from 'react';
import { Alert } from 'react-native';
import type { WebView } from 'react-native-webview';
import {
  deleteBlogEditorImage,
  uploadBlogEditorImageDetails,
} from '@/components/blog-editor/blog-editor-api';
import { buildInsertImageScript } from '@/components/blog-editor/blog-editor-commands';
import { supabase } from '@/lib/supabase';

interface UseBlogImageUploadOptions {
  webViewRef: RefObject<WebView | null>;
}

const EDITOR_UNAVAILABLE_TITLE = 'Editor unavailable';
const EDITOR_UNAVAILABLE_MESSAGE =
  'Please wait for the editor to finish loading.';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    try {
      const serializedError = JSON.stringify(
        error,
        Object.getOwnPropertyNames(error)
      );

      if (serializedError) {
        return serializedError;
      }
    } catch {
      const errorRecord = error as { message?: unknown };

      if (typeof errorRecord.message === 'string' && errorRecord.message) {
        return errorRecord.message;
      }

      return String(error) || 'An unknown error occurred';
    }
  }

  return 'Unknown error';
}

export function useBlogImageUpload({ webViewRef }: UseBlogImageUploadOptions) {
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImagePick = async () => {
    if (!webViewRef.current) {
      Alert.alert(EDITOR_UNAVAILABLE_TITLE, EDITOR_UNAVAILABLE_MESSAGE);
      return;
    }

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setIsUploadingImage(true);
      const asset = result.assets[0];

      if (!asset?.uri) {
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'No session');
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
      const uploadedImage = await uploadBlogEditorImageDetails({
        accessToken: session.access_token,
        apiUrl,
        asset,
      });

      const editorWebView = webViewRef.current;

      if (!editorWebView) {
        try {
          await deleteBlogEditorImage({
            accessToken: session.access_token,
            apiUrl,
            path: uploadedImage.path,
          });
        } catch (cleanupError) {
          console.error('[ImagePick] Cleanup error:', cleanupError);
        }

        Alert.alert(EDITOR_UNAVAILABLE_TITLE, EDITOR_UNAVAILABLE_MESSAGE);
        return;
      }

      editorWebView.injectJavaScript(buildInsertImageScript(uploadedImage.url));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('[ImagePick] Upload error:', message);
      Alert.alert('Upload Failed', message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  return {
    handleImagePick,
    isUploadingImage,
  };
}
