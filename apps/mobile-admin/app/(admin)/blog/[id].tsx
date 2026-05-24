import Ionicons from "@react-native-vector-icons/ionicons/static";
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { createUploadFile, type RNFormData } from '@/types/upload';

// Route param validation - accepts UUID or 'new' for creating new posts
const routeParamsSchema = z.object({
  id: z.union([z.literal('new'), z.string().uuid()]),
});

export default function BlogPostDetailScreen() {
  const rawParams = useLocalSearchParams();
  const { colors } = useTheme();
  const { merchant } = useMerchant();

  // Validate route params with Zod
  const paramsResult = routeParamsSchema.safeParse(rawParams);
  const validatedParams = paramsResult.success ? paramsResult.data : null;

  // Extract id safely (will be undefined if validation fails)
  const id = validatedParams?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    'draft'
  );

  useEffect(() => {
    const fetchPost = async () => {
      if (!id || id === 'new') return;
      if (!merchant?.id) return;
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('title, excerpt, category, featured_image_url, status')
          .eq('id', id)
          .eq('merchant_id', merchant.id)
          .single();

        if (error) throw error;
        setTitle(data.title);
        setExcerpt(data.excerpt || '');
        setCategory(data.category || '');
        setFeaturedImage(data.featured_image_url || '');
        setStatus(data.status);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load post');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    if (id && id !== 'new') {
      fetchPost();
    } else {
      setIsLoading(false);
    }
  }, [id, merchant?.id]);

  // Show error screen for invalid route params (after all hooks)
  if (!validatedParams) {
    return (
      <InvalidRouteScreen
        title="Invalid Blog Post"
        message="The blog post ID is invalid. Please check the link and try again."
      />
    );
  }

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Updated to match type
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setIsSaving(true);
    try {
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${merchant?.id}/blog/${Date.now()}.${fileExt}`;

      // Use FormData for reliable file upload in React Native
      const fileData = new FormData() as RNFormData;
      const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      fileData.append(
        'file',
        createUploadFile({
          uri: uri,
          name: fileName.split('/').pop() || 'image.jpg',
          type: mimeType,
        })
      );

      const { error: uploadError } = await supabase.storage
        .from('merchant-assets')
        .upload(fileName, fileData, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('merchant-assets')
        .getPublicUrl(fileName);

      setFeaturedImage(data.publicUrl);
    } catch (e: unknown) {
      Alert.alert('Upload Failed', (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!merchant?.id) {
        throw new Error('Merchant ID is missing');
      }

      const payload = {
        title,
        excerpt,
        category,
        featured_image_url: featuredImage,
        status,
        merchant_id: merchant.id,
        updated_at: new Date().toISOString(),
      };

      if (id === 'new') {
        // Create
        // Minimal required fields
        const { error } = await supabase.from('blog_posts').insert([
          {
            ...payload,
            slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          },
        ]);
        if (error) throw error;
      } else {
        // Update
        const { error } = await supabase
          .from('blog_posts')
          .update(payload)
          .eq('id', id)
          .eq('merchant_id', merchant.id);
        if (error) throw error;
      }

      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!merchant?.id) {
              throw new Error('Merchant ID is missing');
            }

            const { error } = await supabase
              .from('blog_posts')
              .delete()
              .eq('id', id)
              .eq('merchant_id', merchant.id);

            if (error) {
              throw error;
            }

            router.back();
          } catch (e: unknown) {
            console.error('Failed to delete blog post:', e);
            Alert.alert(
              'Error',
              'Failed to delete blog post. Please try again.'
            );
          }
        },
      },
    ]);
  };

  if (isLoading)
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go Back"
          accessibilityHint="Navigates to the previous screen"
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {id === 'new' ? 'New Post' : 'Edit Post'}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Save Post"
          accessibilityState={{ disabled: isSaving }}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.primary }]}>
              Save
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Image Section */}
        <Pressable
          onPress={handlePickImage}
          style={[
            styles.imageContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {featuredImage ? (
            <>
              <SafeImage
                source={{ uri: featuredImage }}
                style={styles.featuredImage}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="white" />
              </View>
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={40}
                color={colors.textMuted}
              />
              <Text style={{ color: colors.textMuted, marginTop: 8 }}>
                Add Cover Image
              </Text>
            </View>
          )}
        </Pressable>

        {/* Status Toggles */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            STATUS
          </Text>
          <View style={styles.statusRow}>
            {(['draft', 'published', 'archived'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={[
                  styles.statusButton,
                  status === s && { backgroundColor: colors.primaryLight },
                  {
                    borderColor: status === s ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: status === s ? colors.primary : colors.textMuted },
                  ]}
                >
                  {s.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Fields */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            TITLE <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Post Title"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text
            style={[
              styles.label,
              { color: colors.textSecondary, marginTop: 16 },
            ]}
          >
            CATEGORY <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Tech News"
            placeholderTextColor={colors.textMuted}
          />

          <Text
            style={[
              styles.label,
              { color: colors.textSecondary, marginTop: 16 },
            ]}
          >
            EXCERPT
          </Text>
          <TextInput
            style={[
              styles.textArea,
              { color: colors.text, borderColor: colors.border },
            ]}
            value={excerpt}
            onChangeText={setExcerpt}
            placeholder="Short summary..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Content Actions */}
        <View style={{ marginBottom: SPACING.lg }}>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Preview',
                'Preview functionality coming soon! Check the web dashboard for live preview.'
              )
            }
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.card, borderColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Preview Article"
            accessibilityHint="Shows a preview of the article"
          >
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Preview Article
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/blog/edit-content',
                params: { id },
              })
            }
            style={[
              styles.actionButton,
              { backgroundColor: colors.card, borderColor: colors.primary },
            ]}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Edit Content
            </Text>
          </Pressable>
        </View>

        {id !== 'new' && (
          <Pressable
            onPress={handleDelete}
            style={[
              styles.deleteButton,
              { backgroundColor: colors.errorLight },
            ]}
          >
            <Text style={[styles.deleteText, { color: colors.error }]}>
              Delete Post
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  content: {
    padding: SPACING.lg,
  },

  // Image
  imageContainer: {
    height: 200,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: SPACING.lg,
    borderStyle: 'dashed',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },

  // Forms
  section: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    padding: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  textArea: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    padding: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: 100,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statusButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  statusText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },

  // Actions
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
    gap: 8,
  },
  actionText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  deleteButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  deleteText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  note: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.xs,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
});
