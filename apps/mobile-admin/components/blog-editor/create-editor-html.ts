import { sanitizeEditorHtml } from '@/components/blog-editor/sanitize-editor-html';
import type { ThemeColors } from '@/constants/theme';
import {
  getTranslucentColor,
  sanitizeCssColor,
} from '@/lib/colors/sanitize-css-color';

interface CreateEditorHtmlOptions {
  colors: ThemeColors;
  content: string;
}

export function buildEditorTheme(colors: ThemeColors) {
  const safeColors = {
    background: sanitizeCssColor(colors.background, '#0F172A'),
    border: sanitizeCssColor(colors.border, '#334155'),
    card: sanitizeCssColor(colors.card, '#1E293B'),
    primary: sanitizeCssColor(colors.primary, '#3B82F6'),
    text: sanitizeCssColor(colors.text, '#F8FAFC'),
    textMuted: sanitizeCssColor(colors.textMuted, '#94A3B8'),
  };

  return {
    ...safeColors,
    blockquoteBackground: getTranslucentColor(
      safeColors.card,
      'rgba(148, 163, 184, 0.16)',
      0.25
    ),
  };
}

export function buildApplyEditorThemeScript(colors: ThemeColors): string {
  return `
    window.__baciApplyEditorTheme?.(${JSON.stringify(buildEditorTheme(colors))});
    true;
  `;
}

export function createEditorHtml({
  colors,
  content,
}: CreateEditorHtmlOptions): string {
  const editorTheme = buildEditorTheme(colors);
  const sanitizedContent = sanitizeEditorHtml(content);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >
        <style>
          :root {
            --editor-background: ${editorTheme.background};
            --editor-blockquote-background: ${editorTheme.blockquoteBackground};
            --editor-border: ${editorTheme.border};
            --editor-card: ${editorTheme.card};
            --editor-primary: ${editorTheme.primary};
            --editor-text: ${editorTheme.text};
            --editor-text-muted: ${editorTheme.textMuted};
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: var(--editor-background);
            color: var(--editor-text);
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
            font-size: 17px;
            line-height: 1.7;
            min-height: 100vh;
            padding: 20px;
            -webkit-user-select: text;
          }
          #editor {
            min-height: 400px;
            outline: none;
            padding-bottom: 100px;
          }
          #editor:empty:before {
            color: var(--editor-text-muted);
            content: 'Start writing your story...';
          }
          h1, h2, h3 {
            color: var(--editor-text);
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            margin-top: 24px;
          }
          h1 { font-size: 30px; letter-spacing: -0.5px; margin-bottom: 16px; }
          h2 { font-size: 26px; margin-bottom: 12px; }
          h3 { font-size: 22px; margin-bottom: 10px; }
          p { font-weight: 400; margin-bottom: 16px; }
          ul, ol { margin: 16px 0; padding-left: 28px; }
          li { margin-bottom: 8px; }
          a {
            color: var(--editor-primary);
            text-decoration: underline;
            text-underline-offset: 4px;
          }
          img {
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            height: auto;
            margin: 20px 0;
            max-width: 100%;
          }
          blockquote {
            background: var(--editor-blockquote-background);
            border-left: 4px solid var(--editor-primary);
            border-radius: 0 8px 8px 0;
            color: var(--editor-text-muted);
            font-style: italic;
            margin: 20px 0;
            padding-bottom: 4px;
            padding-left: 20px;
            padding-top: 4px;
          }
          hr { border: 0; border-top: 1px solid var(--editor-border); margin: 24px 0; }
          table {
            border-collapse: collapse;
            font-size: 15px;
            margin: 20px 0;
            width: 100%;
          }
          th, td {
            border: 1px solid var(--editor-border);
            padding: 12px;
            text-align: left;
          }
          th {
            background: var(--editor-card);
            font-weight: 600;
          }
          .video-container {
            background: #000;
            border-radius: 12px;
            height: 0;
            margin: 20px 0;
            overflow: hidden;
            padding-bottom: 56.25%;
            position: relative;
          }
          .video-container iframe {
            border: 0;
            height: 100%;
            left: 0;
            position: absolute;
            top: 0;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="editor" contenteditable="true">${sanitizedContent}</div>
        <script>
          const editor = document.getElementById('editor');
          let changeTimeout = null;
          const themeVariables = {
            background: '--editor-background',
            blockquoteBackground: '--editor-blockquote-background',
            border: '--editor-border',
            card: '--editor-card',
            primary: '--editor-primary',
            text: '--editor-text',
            textMuted: '--editor-text-muted'
          };

          window.__baciApplyEditorTheme = function(theme) {
            if (!theme || typeof theme !== 'object') {
              return;
            }

            Object.entries(themeVariables).forEach(([key, variableName]) => {
              const value = theme[key];

              if (typeof value === 'string') {
                document.documentElement.style.setProperty(variableName, value);
              }
            });
          };

          if (editor && window.ReactNativeWebView?.postMessage) {
            editor.addEventListener('input', function() {
              if (changeTimeout) {
                clearTimeout(changeTimeout);
              }

              changeTimeout = setTimeout(function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'content_change',
                  content: editor.innerHTML
                }));
              }, 75);
            });
          }
        </script>
      </body>
    </html>
  `;
}
