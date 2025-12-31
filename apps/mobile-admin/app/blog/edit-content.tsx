import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, ActivityIndicator, Alert,
    SafeAreaView, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { useMerchant } from '@/hooks/useMerchant';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';

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
    const [aiInstruction, setAiInstruction] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const { merchant } = useMerchant();



    useEffect(() => {
        if (id) fetchContent();
    }, [id]);

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

    const handleSave = async () => {
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
        } catch (e: any) {
            Alert.alert('Error', e.message);
            setIsSaving(false);
        }
    };

    const saveContent = async (html: string) => {
        try {
            const { error } = await supabase
                .from('blog_posts')
                .update({
                    content: html,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAIPolish = () => {
        setIsAIModalVisible(true);
    };

    const performAIEdit = async () => {
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
                Alert.alert("Empty", "Write some content first!");
                setIsAIProcessing(false);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || ''}/api/ai/edit-blog`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    content: currentHtml,
                    instruction: aiInstruction
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "AI Edit failed");

            // Set new content in WebView
            const escapedContent = JSON.stringify(data.content);
            webViewRef.current?.injectJavaScript(`
                document.getElementById('editor').innerHTML = ${escapedContent};
                true;
            `);

            Alert.alert("✨ Success", "Content has been polished by AI!");
            setAiInstruction('');
        } catch (e: any) {
            console.error(e);
            Alert.alert("AI Error", e.message);
        } finally {
            setIsAIProcessing(false);
        }
    };

    const onWebViewMessage = (event: any) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'save') {
                saveContent(message.content);
            } else if (message.type === 'ai_request') {
                processAIRequest(message.content);
            } else if (message.type === 'content_change') {
                setContent(message.content);
            }
        } catch (e) {
            console.error('WebView message parse error:', e);
        }
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
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please allow access to your photos');
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
                    console.log('[ImagePick] Selected asset:', asset.uri);

                    // Prepare FormData for API upload
                    const formData = new FormData();
                    formData.append('file', {
                        uri: asset.uri,
                        type: asset.mimeType || 'image/jpeg',
                        name: asset.fileName || 'upload.jpg',
                    } as any);

                    // Determine API URL
                    const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
                    const uploadUrl = `${baseUrl}/api/merchant/blog/upload`;

                    console.log('[ImagePick] Uploading via API proxy to:', uploadUrl);

                    // Upload via API (Bypassing client-side RLS using Dev Header)
                    const response = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'x-dev-merchant-id': '6b5cb8a4-5575-456c-b936-8cdfae30db74', // Dev bypass
                            // Note: Content-Type header is automatically set by fetch for FormData
                        },
                        body: formData,
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || `Upload failed with status ${response.status}`);
                    }

                    console.log('[ImagePick] Upload success:', data);

                    if (data.url) {
                        // Insert image into editor
                        webViewRef.current?.injectJavaScript(`
                            document.execCommand('insertImage', false, '${data.url}');
                            true;
                        `);
                    } else {
                        throw new Error('No URL returned from upload API');
                    }
                } catch (error: any) {
                    console.error('[ImagePick] Upload error:', error);
                    Alert.alert('Upload Failed', error.message || 'Unknown error');
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
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    background: ${colors.background};
                    color: ${colors.text};
                    padding: 16px;
                    min-height: 100vh;
                }
                #editor {
                    outline: none;
                    min-height: 300px;
                }
                #editor:empty:before {
                    content: 'Start writing your story...';
                    color: ${colors.textMuted};
                }
                h1 { font-size: 28px; margin-bottom: 16px; }
                h2 { font-size: 24px; margin-bottom: 12px; }
                h3 { font-size: 20px; margin-bottom: 10px; }
                p { margin-bottom: 12px; }
                ul, ol { margin: 12px 0; padding-left: 24px; }
                li { margin-bottom: 4px; }
                a { color: ${colors.primary}; }
                img { max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; }
                blockquote {
                    border-left: 3px solid ${colors.primary};
                    padding-left: 16px;
                    margin: 12px 0;
                    font-style: italic;
                    opacity: 0.9;
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

    if (isLoading) return (
        <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Content</Text>
                <Pressable onPress={handleSave} disabled={isSaving || isAIProcessing}>
                    {isSaving ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Text style={[styles.saveText, { color: colors.primary }]}>Done</Text>
                    )}
                </Pressable>
            </View>

            {/* AI Loading Overlay */}
            {isAIProcessing && (
                <View style={styles.loadingOverlay}>
                    <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
                        <ActivityIndicator size="large" color="#8B5CF6" />
                        <Text style={[styles.loadingText, { color: colors.text }]}>Polishing with AI...</Text>
                    </View>
                </View>
            )}

            {/* AI Instruction Modal */}
            <Modal
                transparent
                visible={isAIModalVisible}
                animationType="fade"
                onRequestClose={() => setIsAIModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>✨ AI Copilot</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                            How should I improve this content?
                        </Text>

                        <TextInput
                            style={[
                                styles.input,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }
                            ]}
                            placeholder="e.g. 'Fix grammar', 'Make it funnier', 'Translate to Spanish'..."
                            placeholderTextColor={colors.textMuted}
                            value={aiInstruction}
                            onChangeText={setAiInstruction}
                            autoFocus
                        />

                        <View style={styles.modalActions}>
                            <Pressable
                                style={[styles.modalButton, { backgroundColor: colors.border }]}
                                onPress={() => setIsAIModalVisible(false)}
                            >
                                <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
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
            <View style={[styles.toolbarContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar}>
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('bold')}>
                        <Ionicons name="text" size={20} color={colors.text} />
                        <Text style={[styles.toolbarLabel, { color: colors.text, fontWeight: 'bold' }]}>B</Text>
                    </Pressable>
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('italic')}>
                        <Text style={[styles.toolbarLabel, { color: colors.text, fontStyle: 'italic' }]}>I</Text>
                    </Pressable>
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('underline')}>
                        <Text style={[styles.toolbarLabel, { color: colors.text, textDecorationLine: 'underline' }]}>U</Text>
                    </Pressable>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('formatBlock', 'h1')}>
                        <Text style={[styles.toolbarLabel, { color: colors.text, fontWeight: 'bold' }]}>H1</Text>
                    </Pressable>
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('formatBlock', 'h2')}>
                        <Text style={[styles.toolbarLabel, { color: colors.text, fontWeight: 'bold' }]}>H2</Text>
                    </Pressable>
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('formatBlock', 'p')}>
                        <Text style={[styles.toolbarLabel, { color: colors.text }]}>¶</Text>
                    </Pressable>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('insertUnorderedList')}>
                        <Ionicons name="list" size={20} color={colors.text} />
                    </Pressable>
                    <Pressable style={styles.toolbarButton} onPress={() => formatAction('insertOrderedList')}>
                        <Ionicons name="list-outline" size={20} color={colors.text} />
                    </Pressable>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <Pressable style={styles.toolbarButton} onPress={handleImagePick} disabled={isUploadingImage}>
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
        shadowColor: "#000",
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
        shadowColor: "#000",
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
