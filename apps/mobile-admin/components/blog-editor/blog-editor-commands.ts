export type FormatCommand =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'formatBlock'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'insertHorizontalRule';
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const MAX_TABLE_DIMENSION = 100;

function escapeScriptValue(value: string): string {
  return JSON.stringify(value);
}

function buildEditorContentPostMessageScript(
  type: 'ai_request' | 'save'
): string {
  return `
    const editor = document.getElementById('editor');
    const content = editor instanceof HTMLElement ? editor.innerHTML : '';
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: ${escapeScriptValue(type)},
      content
    }));
    true;
  `;
}

function extractYouTubeVideoId(url: string): string | null {
  const trimmedUrl = url.trim();
  if (YOUTUBE_VIDEO_ID_PATTERN.test(trimmedUrl)) {
    return trimmedUrl;
  }

  const normalizeVideoId = (value: string | null | undefined): string | null =>
    value && YOUTUBE_VIDEO_ID_PATTERN.test(value) ? value : null;

  try {
    const parsedUrl = new URL(trimmedUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    if (hostname === 'youtu.be') {
      return normalizeVideoId(pathSegments[0] ?? null);
    }

    if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtube-nocookie.com'
    ) {
      if (parsedUrl.pathname === '/watch') {
        return normalizeVideoId(parsedUrl.searchParams.get('v'));
      }

      if (
        pathSegments[0] &&
        ['embed', 'live', 'shorts', 'v'].includes(pathSegments[0])
      ) {
        return normalizeVideoId(pathSegments[1] ?? null);
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function buildAiRequestScript(): string {
  return buildEditorContentPostMessageScript('ai_request');
}

export function buildCreateLinkScript(url: string): string {
  return `
    document.execCommand('createLink', false, ${escapeScriptValue(url)});
    true;
  `;
}

export function buildFormatActionScript(
  command: FormatCommand,
  value?: string
): string {
  return value
    ? `document.execCommand(${escapeScriptValue(command)}, false, ${escapeScriptValue(value)}); true;`
    : `document.execCommand(${escapeScriptValue(command)}, false, null); true;`;
}

export function buildInsertImageScript(url: string): string {
  return `
    document.execCommand('insertImage', false, ${escapeScriptValue(url)});
    true;
  `;
}

export function buildInsertTableScript(rows = 2, cols = 2): string {
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) {
    throw new RangeError('Table dimensions must be finite numbers.');
  }

  const normalizedRows = Math.max(
    1,
    Math.min(MAX_TABLE_DIMENSION, Math.floor(rows))
  );
  const normalizedCols = Math.max(
    1,
    Math.min(MAX_TABLE_DIMENSION, Math.floor(cols))
  );

  return `
    const rows = ${normalizedRows};
    const cols = ${normalizedCols};
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
  `;
}

export function buildInsertVideoScript(url: string): string {
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) {
    return 'true;';
  }

  const embedHtml = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allowfullscreen></iframe></div><p></p>`;

  return `
    document.execCommand('insertHTML', false, ${escapeScriptValue(embedHtml)});
    true;
  `;
}

export function buildSaveRequestScript(): string {
  return buildEditorContentPostMessageScript('save');
}
