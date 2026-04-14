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

function escapeScriptValue(value: string): string {
  return JSON.stringify(value);
}

export function buildAiRequestScript(): string {
  return `
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ai_request',
      content: document.getElementById('editor').innerHTML
    }));
    true;
  `;
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

export function buildInsertTableScript(): string {
  return `
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
  `;
}

export function buildInsertVideoScript(url: string): string {
  const videoId =
    url.match(
      /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandaylm\?v=))([\w-]{11})/
    )?.[1] || url;

  const embedHtml = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div><p></p>`;

  return `
    document.execCommand('insertHTML', false, ${escapeScriptValue(embedHtml)});
    true;
  `;
}

export function buildSaveRequestScript(): string {
  return `
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'save',
      content: document.getElementById('editor').innerHTML
    }));
    true;
  `;
}
