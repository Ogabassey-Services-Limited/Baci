import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { FormatCommand } from '@/components/blog-editor/blog-editor-commands';
import type { ThemeColors } from '@/constants/theme';
import { blogEditorStyles } from './blog-editor.styles';

interface BlogEditorToolbarProps {
  colors: ThemeColors;
  isUploadingImage: boolean;
  onFormatAction: (command: FormatCommand, value?: string) => void;
  onInsertImage: () => void;
  onInsertLink: () => void;
  onInsertTable: () => void;
  onInsertVideo: () => void;
}

export function BlogEditorToolbar({
  colors,
  isUploadingImage,
  onFormatAction,
  onInsertImage,
  onInsertLink,
  onInsertTable,
  onInsertVideo,
}: BlogEditorToolbarProps) {
  return (
    <View
      style={[
        blogEditorStyles.toolbarContainer,
        { backgroundColor: colors.card, borderTopColor: colors.border },
      ]}
    >
      <ScrollView
        contentContainerStyle={blogEditorStyles.toolbar}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <Pressable
          accessibilityLabel="Undo"
          onPress={() => onFormatAction('undo')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Redo"
          onPress={() => onFormatAction('redo')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="arrow-redo-outline" size={20} color={colors.text} />
        </Pressable>
        <View
          style={[blogEditorStyles.divider, { backgroundColor: colors.border }]}
        />
        <Pressable
          accessibilityLabel="Bold"
          onPress={() => onFormatAction('bold')}
          style={blogEditorStyles.toolbarButton}
        >
          <Text
            style={[
              blogEditorStyles.toolbarLabel,
              { color: colors.text, fontWeight: 'bold' },
            ]}
          >
            B
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Italic"
          onPress={() => onFormatAction('italic')}
          style={blogEditorStyles.toolbarButton}
        >
          <Text
            style={[
              blogEditorStyles.toolbarLabel,
              { color: colors.text, fontStyle: 'italic' },
            ]}
          >
            I
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Underline"
          onPress={() => onFormatAction('underline')}
          style={blogEditorStyles.toolbarButton}
        >
          <Text
            style={[
              blogEditorStyles.toolbarLabel,
              { color: colors.text, textDecorationLine: 'underline' },
            ]}
          >
            U
          </Text>
        </Pressable>
        <View
          style={[blogEditorStyles.divider, { backgroundColor: colors.border }]}
        />
        <Pressable
          accessibilityLabel="Heading 1"
          onPress={() => onFormatAction('formatBlock', 'h1')}
          style={blogEditorStyles.toolbarButton}
        >
          <Text
            style={[
              blogEditorStyles.toolbarLabel,
              { color: colors.text, fontWeight: 'bold' },
            ]}
          >
            H1
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Heading 2"
          onPress={() => onFormatAction('formatBlock', 'h2')}
          style={blogEditorStyles.toolbarButton}
        >
          <Text
            style={[
              blogEditorStyles.toolbarLabel,
              { color: colors.text, fontWeight: 'bold' },
            ]}
          >
            H2
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Heading 3"
          onPress={() => onFormatAction('formatBlock', 'h3')}
          style={blogEditorStyles.toolbarButton}
        >
          <Text
            style={[
              blogEditorStyles.toolbarLabel,
              { color: colors.text, fontWeight: 'bold' },
            ]}
          >
            H3
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Paragraph"
          onPress={() => onFormatAction('formatBlock', 'p')}
          style={blogEditorStyles.toolbarButton}
        >
          <Text style={[blogEditorStyles.toolbarLabel, { color: colors.text }]}>
            ¶
          </Text>
        </Pressable>
        <View
          style={[blogEditorStyles.divider, { backgroundColor: colors.border }]}
        />
        <Pressable
          accessibilityLabel="Align left"
          onPress={() => onFormatAction('justifyLeft')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="reorder-two-outline" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Align center"
          onPress={() => onFormatAction('justifyCenter')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons
            name="reorder-three-outline"
            size={20}
            color={colors.text}
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Align right"
          onPress={() => onFormatAction('justifyRight')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="reorder-four-outline" size={20} color={colors.text} />
        </Pressable>
        <View
          style={[blogEditorStyles.divider, { backgroundColor: colors.border }]}
        />
        <Pressable
          accessibilityLabel="Bulleted list"
          onPress={() => onFormatAction('insertUnorderedList')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="list" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Numbered list"
          onPress={() => onFormatAction('insertOrderedList')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="list-outline" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Insert divider"
          onPress={() => onFormatAction('insertHorizontalRule')}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="remove-outline" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Insert link"
          onPress={onInsertLink}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="link-outline" size={22} color={colors.primary} />
        </Pressable>
        <View
          style={[blogEditorStyles.divider, { backgroundColor: colors.border }]}
        />
        <Pressable
          accessibilityLabel="Insert table"
          onPress={onInsertTable}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="grid-outline" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Insert video"
          onPress={onInsertVideo}
          style={blogEditorStyles.toolbarButton}
        >
          <Ionicons name="logo-youtube" size={20} color={colors.text} />
        </Pressable>
        <View
          style={[blogEditorStyles.divider, { backgroundColor: colors.border }]}
        />
        <Pressable
          accessibilityLabel="Insert image"
          accessibilityState={{ disabled: isUploadingImage }}
          disabled={isUploadingImage}
          onPress={onInsertImage}
          style={blogEditorStyles.toolbarButton}
        >
          {isUploadingImage ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="image-outline" size={22} color={colors.primary} />
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
