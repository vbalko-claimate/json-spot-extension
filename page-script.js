(() => {
  'use strict';

  if (window.__jsonspot_page_script_loaded) return;
  window.__jsonspot_page_script_loaded = true;

  const JSON_SIZE_LIMIT = 5 * 1024 * 1024;

  // ── JSON Utilities ─────────────────────────────────────
  function isLikelyJSON(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    if (trimmed.length === 0 || trimmed.length > JSON_SIZE_LIMIT) return false;
    const firstChar = trimmed[0];
    if (firstChar !== '{' && firstChar !== '[') return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  // ── Editor Value Getters ───────────────────────────────
  function getEditorValue(el, editorType) {
    switch (editorType) {
      case 'codemirror5':
        if (el.CodeMirror) return el.CodeMirror.getValue();
        throw new Error('CodeMirror 5 instance not found');

      case 'codemirror6':
        if (el.cmView && el.cmView.view) {
          return el.cmView.view.state.doc.toString();
        }
        throw new Error('CodeMirror 6 view not found');

      case 'monaco': {
        if (typeof monaco !== 'undefined' && monaco.editor && monaco.editor.getEditors) {
          const editors = monaco.editor.getEditors();
          for (const editor of editors) {
            const container = editor.getContainerDomNode();
            if (el === container || el.contains(container) || container.contains(el)) {
              return editor.getValue();
            }
          }
        }
        throw new Error('Monaco editor instance not found');
      }

      case 'ace':
        if (el.env && el.env.editor) return el.env.editor.getValue();
        throw new Error('Ace editor instance not found');

      default:
        throw new Error('Unknown editor type: ' + editorType);
    }
  }

  // ── Editor Value Setters ───────────────────────────────
  function setEditorValue(el, editorType, value) {
    switch (editorType) {
      case 'codemirror5':
        el.CodeMirror.setValue(value);
        break;

      case 'codemirror6': {
        const view = el.cmView.view;
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: value
          }
        });
        break;
      }

      case 'monaco': {
        const editors = monaco.editor.getEditors();
        for (const editor of editors) {
          const container = editor.getContainerDomNode();
          if (el === container || el.contains(container) || container.contains(el)) {
            editor.setValue(value);
            break;
          }
        }
        break;
      }

      case 'ace':
        el.env.editor.setValue(value, -1);
        break;
    }
  }

  // ── Format/Minify Handler ──────────────────────────────
  function handleEditor(el, editorType, action, indent) {
    const value = getEditorValue(el, editorType);
    if (!value) return { success: false, error: 'Empty editor' };

    const clean = value.replace(/^\uFEFF/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return { success: false, error: 'Invalid JSON: ' + e.message };
    }

    const formatted = action === 'format'
      ? JSON.stringify(parsed, null, indent)
      : JSON.stringify(parsed);

    setEditorValue(el, editorType, formatted);
    return { success: true };
  }

  // ── Event Listeners ────────────────────────────────────
  document.addEventListener('jsonspot-request', (event) => {
    const { requestId, editorType, action, indent } = event.detail;
    let result;

    try {
      const el = document.querySelector(`[data-jsonspot-id="${requestId}"]`);
      if (!el) throw new Error('Element not found');
      result = handleEditor(el, editorType, action, indent || 2);
    } catch (err) {
      result = { success: false, error: err.message };
    }

    document.dispatchEvent(new CustomEvent('jsonspot-response', {
      detail: { requestId, ...result }
    }));
  });

  document.addEventListener('jsonspot-check', (event) => {
    const { requestId, editorType } = event.detail;
    let result;

    try {
      const el = document.querySelector(`[data-jsonspot-id="${requestId}"]`);
      if (!el) throw new Error('Element not found');
      const value = getEditorValue(el, editorType);
      result = { success: true, isJSON: isLikelyJSON(value) };
    } catch {
      result = { success: false, isJSON: false };
    }

    document.dispatchEvent(new CustomEvent('jsonspot-check-response', {
      detail: { requestId, ...result }
    }));
  });
})();
