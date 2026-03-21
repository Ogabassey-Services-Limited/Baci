import { BackgroundColor } from '@tiptap/extension-text-style/background-color';
import { Color } from '@tiptap/extension-text-style/color';
import { FontFamily } from '@tiptap/extension-text-style/font-family';
import { FontSize } from '@tiptap/extension-text-style/font-size';
import { LineHeight } from '@tiptap/extension-text-style/line-height';
import { TextStyle } from '@tiptap/extension-text-style/text-style';
import { TextStyleKit } from '@tiptap/extension-text-style/text-style-kit';

// `novel@1.0.2` expects a legacy default export here, but Tiptap v3
// only provides named exports. This shim keeps both forms available.
export {
  BackgroundColor,
  Color,
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
  TextStyleKit,
};

export default TextStyle;
