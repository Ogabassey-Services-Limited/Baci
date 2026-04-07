import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
// import { useMerchant } from '@/hooks/useMerchant';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { parseWebViewEditorMessage } from '@/lib/validators/storage';
import { asUploadFile } from '@/types/upload';

/**
 * WebView-based Rich Text Editor
 * Compatible with React Native 0.81+ (uses react-native-webview)
 */
export default function EditContentScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // AI State
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isAIModalVisible, setIsAIModalVisible] = useState(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('content')
          .eq('id', id)
          .single();

        if (error) throw error;
        setContent(data.content || '');
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load content');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchContent();
  }, [id]);

  const handleSave = () => {
    setIsSaving(true);
    try {
      // Request content from WebView
      webViewRef.current?.injectJavaScript(`
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'save',
                    content: document.getElementById('editor').innerHTML
                }));
                true;
            `);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
      setIsSaving(false);
    }
  };

  const saveContent = async (html: string) => {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({
          content: html,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIPolish = () => {
    setIsAIModalVisible(true);
  };

  const performAIEdit = () => {
    setIsAIModalVisible(false);
    setIsAIProcessing(true);

    // Get current content from WebView
    webViewRef.current?.injectJavaScript(`
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ai_request',
                content: document.getElementById('editor').innerHTML
            }));
            true;
        `);
  };

  const processAIRequest = async (currentHtml: string) => {
    try {
      if (!currentHtml.trim()) {
        Alert.alert('Empty', 'Write some content first!');
        setIsAIProcessing(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || ''}/api/ai/edit-blog`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            content: currentHtml,
            instruction: aiInstruction,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI Edit failed');

      // Set new content in WebView
      const escapedContent = JSON.stringify(data.content);
      webViewRef.current?.injectJavaScript(`
                document.getElementById('editor').innerHTML = ${escapedContent};
                true;
            `);

      Alert.alert('✨ Success', 'Content has been polished by AI!');
      setAiInstruction('');
    } catch (e: unknown) {
      console.error(e);
      Alert.alert('AI Error', (e as Error).message);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const onWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    // Use Zod schema validation for safe parsing of WebView messages
    const message = parseWebViewEditorMessage(event.nativeEvent.data);
    if (!message) {
      console.error('WebView message parse error: invalid message format');
      return;
    }

    switch (message.type) {
      case 'save':
        saveContent(message.content);
        break;
      case 'ai_request':
        processAIRequest(message.content);
        break;
      case 'content_change':
        setContent(message.content);
        break;
    }
  };

  const handleInsertLink = () => {
    if (!linkUrl.trim()) return;

    let url = linkUrl;
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    webViewRef.current?.injectJavaScript(`
      document.execCommand('createLink', false, '${url}');
      true;
    `);

    setLinkUrl('');
    setIsLinkModalVisible(false);
  };

  const formatAction = (command: string, value?: string) => {
    const js = value
      ? `document.execCommand('${command}', false, '${value}'); true;`
      : `document.execCommand('${command}', false, null); true;`;
    webViewRef.current?.injectJavaScript(js);
  };

  // Image picker and upload
  const handleImagePick = async () => {
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
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingImage(true);
        const asset = result.assets[0];

        try {
          if (__DEV__) {
            console.log('[ImagePick] Selected asset:', asset.uri);
          }

          // Prepare FormData for API upload
          const formData = new FormData();
          formData.append(
            'file',
            asUploadFile({
              uri: asset.uri,
              name: asset.fileName || `image-${Date.now()}.png`,
              type: asset.mimeType || 'image/png',
            })
          );

          // Determine API URL
          const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
          const uploadUrl = `${baseUrl}/api/merchant/blog/upload`;

          if (__DEV__) {
            console.log('[ImagePick] Uploading via API proxy to:', uploadUrl);
          }

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error('No session');

          // Upload via API
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              // Note: Content-Type header is automatically set by fetch for FormData
            },
            body: formData,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error || `Upload failed with status ${response.status}`
            );
          }

          if (__DEV__) {
            console.log('[ImagePick] Upload success:', data);
          }

          if (data.url) {
            // Insert image into editor
            webViewRef.current?.injectJavaScript(`
                            document.execCommand('insertImage', false, '${data.url}');
                            true;
                        `);
          } else {
            throw new Error('No URL returned from upload API');
          }
        } catch (error: unknown) {
          console.error('[ImagePick] Upload error:', error);
          Alert.alert(
            'Upload Failed',
            (error as Error).message || 'Unknown error'
          );
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('[ImagePick] Picker error:', error);
      setIsUploadingImage(false);
    }
  };

  // HTML template for the editor
  const editorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
                    font-size: 17px;
                    line-height: 1.7;
                    background: ${colors.background};
                    color: ${colors.text};
                    padding: 20px;
                    min-height: 100vh;
                    -webkit-user-select: text;
                }
                #editor {
                    outline: none;
                    min-height: 400px;
                    padding-bottom: 100px;
                }
                #editor:empty:before {
                    content: 'Start writing your story...';
                    color: ${colors.textMuted};
                }
                h1, h2, h3 { font-family: 'Inter', sans-serif; color: ${colors.text}; font-weight: 700; margin-top: 24px; }
                h1 { font-size: 30px; margin-bottom: 16px; letter-spacing: -0.5px; }
                h2 { font-size: 26px; margin-bottom: 12px; }
                h3 { font-size: 22px; margin-bottom: 10px; }
                p { margin-bottom: 16px; font-weight: 400; }
                ul, ol { margin: 16px 0; padding-left: 28px; }
                li { margin-bottom: 8px; }
                a { color: ${colors.primary}; text-decoration: underline; text-underline-offset: 4px; }
                img { max-width: 100%; height: auto; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                blockquote {
                    border-left: 4px solid ${colors.primary};
                    padding-left: 20px;
                    padding-top: 4px;
                    padding-bottom: 4px;
                    margin: 20px 0;
                    font-style: italic;
                    color: ${colors.textMuted};
                    background: ${colors.card}40;
                    border-radius: 0 8px 8px 0;
                }
                hr { border: 0; border-top: 1px solid ${colors.border}; margin: 24px 0; }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    font-size: 15px;
                }
                th, td {
                    border: 1px solid ${colors.border};
                    padding: 12px;
                    text-align: left;
                }
                th {
                    background: ${colors.card};
                    font-weight: 600;
                }
                .video-container {
                    position: relative;
                    padding-bottom: 56.25%;
                    height: 0;
                    overflow: hidden;
                    margin: 20px 0;
                    border-radius: 12px;
                    background: #000;
                }
                .video-container iframe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border: 0;
                }
            </style>
        </head>
        <body>
            <div id="editor" contenteditable="true">${content}</div>
            <script>
                const editor = document.getElementById('editor');
                editor.addEventListener('input', function() {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'content_change',
                        content: editor.innerHTML
                    }));
                });
            </script>
        </body>
        </html>
    `;

  if (isLoading)
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Edit Content
        </Text>
        <Pressable onPress={handleSave} disabled={isSaving || isAIProcessing}>
          {isSaving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.primary }]}>
              Done
            </Text>
          )}
        </Pressable>
      </View>

      {/* AI Loading Overlay */}
      {isAIProcessing && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Polishing with AI...
            </Text>
          </View>
        </View>
      )}

      {/* Link Input Modal */}
      <Modal
        transparent
        visible={isLinkModalVisible}
        animationType="fade"
        onRequestClose={() => setIsLinkModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              🔗 Insert Link
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://example.com"
              placeholderTextColor={colors.textMuted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              onSubmitEditing={handleInsertLink}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => setIsLinkModalVisible(false)}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleInsertLink}
              >
                <Text style={[styles.buttonText, { color: '#FFF' }]}>
                  Insert
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* AI Instruction Modal */}
      <Modal
        transparent
        visible={isAIModalVisible}
        animationType="fade"
        onRequestClose={() => setIsAIModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              ✨ AI Copilot
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              How should I improve this content?
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              placeholder="e.g. 'Fix grammar', 'Make it funnier', 'Translate to Spanish'..."
              placeholderTextColor={colors.textMuted}
              value={aiInstruction}
              onChangeText={setAiInstruction}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => setIsAIModalVisible(false)}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#8B5CF6' }]}
                onPress={performAIEdit}
              >
                <Text style={[styles.buttonText, { color: '#FFF' }]}>
                  {aiInstruction ? 'Transform' : 'Auto Polish'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* WebView Editor */}
      <View style={styles.editorContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: editorHtml }}
          onMessage={onWebViewMessage}
          scrollEnabled={true}
          keyboardDisplayRequiresUserAction={false}
          style={{ flex: 1, backgroundColor: colors.background }}
        />
      </View>

      {/* Toolbar */}
      <View
        style={[
          styles.toolbarContainer,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbar}
        >
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('undo')}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('redo')}
          >
            <Ionicons name="arrow-redo-outline" size={20} color={colors.text} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('bold')}
          >
            <Ionicons name="text" size={20} color={colors.text} />
            <Text
              style={[
                styles.toolbarLabel,
                { color: colors.text, fontWeight: 'bold' },
              ]}
            >
              B
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('italic')}
          >
            <Text
              style={[
                styles.toolbarLabel,
                { color: colors.text, fontStyle: 'italic' },
              ]}
            >
              I
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('underline')}
          >
            <Text
              style={[
                styles.toolbarLabel,
                { color: colors.text, textDecorationLine: 'underline' },
              ]}
            >
              U
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('formatBlock', 'h1')}
          >
            <Text
              style={[
                styles.toolbarLabel,
                { color: colors.text, fontWeight: 'bold' },
              ]}
            >
              H1
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('formatBlock', 'h2')}
          >
            <Text
              style={[
                styles.toolbarLabel,
                { color: colors.text, fontWeight: 'bold' },
              ]}
            >
              H2
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('formatBlock', 'h3')}
          >
            <Text
              style={[
                styles.toolbarLabel,
                { color: colors.text, fontWeight: 'bold' },
              ]}
            >
              H3
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('formatBlock', 'p')}
          >
            <Text style={[styles.toolbarLabel, { color: colors.text }]}>¶</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable onPress={() => formatAction('justifyLeft')}>
            <Ionicons
              name="reorder-two-outline"
              size={20}
              color={colors.text}
            />
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('justifyCenter')}
          >
            <Ionicons
              name="reorder-three-outline"
              size={20}
              color={colors.text}
            />
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('justifyRight')}
          >
            <Ionicons
              name="reorder-four-outline"
              size={20}
              color={colors.text}
            />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('insertUnorderedList')}
          >
            <Ionicons name="list" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('insertOrderedList')}
          >
            <Ionicons name="list-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => formatAction('insertHorizontalRule')}
          >
            <Ionicons name="remove-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => setIsLinkModalVisible(true)}
          >
            <Ionicons name="link-outline" size={22} color={colors.primary} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.toolbarButton}
            onPress={() => {
              webViewRef.current?.injectJavaScript(`
                const rows = 2;
                const cols = 2;
                let table = '<table>';
                for (let i = 0; i < rows; i++) {
                  table += '<tr>';
                  for (let j = 0; j < cols; j++) {
                    table += i === 0 ? '<th>Header</th>' : '<td>Data</td>';
                  }
                  table += '</tr>';
                }
                table += '</table><p></p>';
                document.execCommand('insertHTML', false, table);
                true;
              `);
            }}
          >
            <Ionicons name="grid-outline" size={20} color={colors.text} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.toolbarButton}
            onPress={() => {
              Alert.prompt(
                'Insert YouTube Video',
                'Enter the YouTube video URL or ID',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Insert',
                    onPress: (url?: string) => {
                      if (!url) return;
                      // Simple regex to extract ID if full URL is provided
                      const videoId =
                        url.match(
                          /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandaylm\?v=))([\w-]{11})/
                        )?.[1] || url;

                      const embedHtml = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div><p></p>`;
                      webViewRef.current?.injectJavaScript(`
                        document.execCommand('insertHTML', false, '${embedHtml}');
                        true;
                      `);
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="logo-youtube" size={20} color={colors.text} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.toolbarButton}
            onPress={handleImagePick}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.primary} />
            )}
          </Pressable>
        </ScrollView>
      </View>

      {/* Floating AI Button */}
      <Pressable
        style={[styles.fab, { backgroundColor: '#8B5CF6' }]}
        onPress={handleAIPolish}
        disabled={isAIProcessing}
      >
        {isAIProcessing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Ionicons name="sparkles" size={26} color="#FFF" />
        )}
      </Pressable>
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
    zIndex: 10,
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
  editorContainer: {
    flex: 1,
  },
  toolbarContainer: {
    borderTopWidth: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  toolbarButton: {
    padding: 10,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarLabel: {
    fontSize: 18,
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  // AI Modal & Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  loadingCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
});
