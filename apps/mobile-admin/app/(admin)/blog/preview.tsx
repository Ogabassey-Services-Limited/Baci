import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { z } from 'zod';
import { blogPreviewStyles as styles } from '@/components/blog-preview/blog-preview.styles';
import { sanitizeEditorHtml } from '@/components/blog-editor/sanitize-editor-html';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import SafeImage from '@/components/ui/SafeImage';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const previewParamsSchema = z.object({
  id: z.string().uuid(),
});

const blogPreviewPostSchema = z.object({
  category: z.string().nullable(),
  content: z.string().nullable(),
  excerpt: z.string().nullable(),
  featured_image_url: z.string().nullable(),
  published_at: z.string().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  title: z.string(),
  updated_at: z.string().nullable(),
});

type BlogPreviewPost = z.infer<typeof blogPreviewPostSchema>;

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getPreviewStatusLabel(status: BlogPreviewPost['status']): string {
  switch (status) {
    case 'published':
      return 'Published preview';
    case 'archived':
      return 'Archived preview';
    default:
      return 'Draft preview';
  }
}

function buildPreviewHtml(content: string | null, colors: { text: string }) {
  const safeContent = sanitizeEditorHtml(content || '').trim();
  const bodyContent = safeContent || '<p>No article content yet.</p>';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      color: ${colors.text};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.7;
      margin: 0;
      padding: 0;
    }
    img, video, iframe {
      border-radius: 16px;
      display: block;
      height: auto;
      max-width: 100%;
    }
    iframe {
      aspect-ratio: 16 / 9;
      width: 100%;
    }
    h1, h2, h3 {
      line-height: 1.25;
    }
  </style>
</head>
<body>${bodyContent}</body>
</html>`;
}

export default function BlogPreviewScreen() {
  const rawParams = useLocalSearchParams();
  const { colors } = useTheme();
  const { merchant } = useMerchant();
  const paramsResult = previewParamsSchema.safeParse({
    id: getSingleParam(rawParams.id),
  });
  const postId = paramsResult.success ? paramsResult.data.id : null;
  const [post, setPost] = useState<BlogPreviewPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!postId) {
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    if (!merchant?.id) {
      setPost(null);
      setErrorMessage('Missing merchant id');
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    async function fetchPost(validPostId: string, merchantId: string) {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select(
            'title, excerpt, category, content, featured_image_url, status, published_at, updated_at'
          )
          .eq('id', validPostId)
          .eq('merchant_id', merchantId)
          .single();

        if (error || !data) {
          throw error ?? new Error('Failed to load post preview');
        }

        const previewPost = blogPreviewPostSchema.parse(data);

        if (isActive) {
          setPost(previewPost);
        }
      } catch (error) {
        console.error('Failed to load blog preview:', error);
        if (isActive) {
          setErrorMessage('Failed to load article preview.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchPost(postId, merchant.id);

    return () => {
      isActive = false;
    };
  }, [merchant?.id, postId]);

  if (!postId) {
    return (
      <InvalidRouteScreen
        title="Invalid Blog Preview"
        message="The blog preview link is invalid. Please return to the article editor."
      />
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityLabel="Close preview"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text selectable style={[styles.headerTitle, { color: colors.text }]}>
          Preview Article
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {errorMessage || !post ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="alert-circle-outline"
            size={32}
            color={colors.error}
          />
          <Text selectable style={[styles.emptyTitle, { color: colors.text }]}>
            Preview not available
          </Text>
          <Text
            selectable
            style={[styles.emptyBody, { color: colors.textSecondary }]}
          >
            {errorMessage || 'This article could not be loaded.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: colors.warningLight },
              ]}
            >
              <Text
                selectable
                style={[styles.statusText, { color: colors.warning }]}
              >
                {getPreviewStatusLabel(post.status)}
              </Text>
            </View>

            {post.featured_image_url ? (
              <SafeImage
                accessibilityLabel="Featured image preview"
                contentFit="cover"
                source={{ uri: post.featured_image_url }}
                style={styles.featuredImage}
              />
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={40}
                  color={colors.textMuted}
                />
                <Text
                  selectable
                  style={[styles.placeholderText, { color: colors.textMuted }]}
                >
                  No featured image
                </Text>
              </View>
            )}

            {post.category ? (
              <Text
                selectable
                style={[styles.category, { color: colors.primary }]}
              >
                {post.category}
              </Text>
            ) : null}

            <Text selectable style={[styles.title, { color: colors.text }]}>
              {post.title}
            </Text>

            {post.excerpt ? (
              <Text
                selectable
                style={[styles.excerpt, { color: colors.textSecondary }]}
              >
                {post.excerpt}
              </Text>
            ) : null}

            <View style={styles.webViewContainer}>
              <WebView
                originWhitelist={['*']}
                source={{ html: buildPreviewHtml(post.content, colors) }}
                style={styles.webView}
              />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
