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
        if (el.env && el.env.editor) {
          const val = el.env.editor.getValue();
          console.log('[JSON Spot] Ace getValue length:', val?.length);
          return val;
        }
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
  // NOTE: CustomEvent.detail does NOT cross world boundaries in Chrome MV3.
  // The content script (ISOLATED world) sends requests by setting data-*
  // attributes on the target element and dispatching a bare CustomEvent.
  // The page script (MAIN world) reads data from data-* attributes,
  // writes results back to data-* attributes, and dispatches a bare event.

  document.addEventListener('jsonspot-request', (event) => {
    // Read request params from the element's dataset
    const el = document.querySelector('[data-jsonspot-request]');
    if (!el) return;

    let params;
    try {
      params = JSON.parse(el.dataset.jsonspotRequest);
    } catch {
      return;
    }
    // Clear the request data
    delete el.dataset.jsonspotRequest;

    const { requestId, editorType, action, indent } = params;
    console.log('[JSON Spot] Request received:', { requestId, editorType, action, indent });
    let result;

    try {
      console.log('[JSON Spot] Found element:', el.tagName, el.className);
      result = handleEditor(el, editorType, action, indent || 2);
      console.log('[JSON Spot] Result:', result.success ? 'success' : 'failed', result.error || '');
    } catch (err) {
      console.log('[JSON Spot] Error:', err.message);
      result = { success: false, error: err.message };
    }

    // Write result to dataset and dispatch response event
    el.dataset.jsonspotResponse = JSON.stringify({ requestId, ...result });
    document.dispatchEvent(new CustomEvent('jsonspot-response'));
  });

  document.addEventListener('jsonspot-check', (event) => {
    const el = document.querySelector('[data-jsonspot-check]');
    if (!el) return;

    let params;
    try {
      params = JSON.parse(el.dataset.jsonspotCheck);
    } catch {
      return;
    }
    delete el.dataset.jsonspotCheck;

    const { requestId, editorType } = params;
    console.log('[JSON Spot] Check received:', { requestId, editorType });
    let result;

    try {
      const value = getEditorValue(el, editorType);
      result = { success: true, isJSON: isLikelyJSON(value) };
      console.log('[JSON Spot] Check result: isJSON =', result.isJSON, 'valueLength =', value?.length);
    } catch (err) {
      console.log('[JSON Spot] Check error:', err.message);
      result = { success: false, isJSON: false };
    }

    el.dataset.jsonspotCheckResponse = JSON.stringify({ requestId, ...result });
    document.dispatchEvent(new CustomEvent('jsonspot-check-response'));
  });
})();
