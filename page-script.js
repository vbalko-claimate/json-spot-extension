(() => {
  'use strict';

  if (window.__jsonspot_page_script_loaded) return;
  window.__jsonspot_page_script_loaded = true;

  const SIZE_LIMIT = 5 * 1024 * 1024;

  // ── JSON Utilities ─────────────────────────────────────
  // NOTE: Detection/formatting functions are duplicated in content.js — keep in sync
  function isLikelyJSON(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    if (trimmed.length === 0 || trimmed.length > SIZE_LIMIT) return false;
    const firstChar = trimmed[0];
    if (firstChar !== '{' && firstChar !== '[') return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  // ── XML Utilities ──────────────────────────────────────
  // NOTE: Detection/formatting functions are duplicated in content.js — keep in sync
  function prepareXMLForValidation(text) {
    // Strip HTML5 doctype (<!DOCTYPE ...>) which is not valid XML
    let xml = text.replace(/^<!DOCTYPE\s+[^>]*>/i, '').trim();
    // Wrap in dummy root to handle documents with trailing comments/PIs
    // (e.g. XSLT output: <html>...</html><!--Run with SAXON HE 10.6 -->)
    return '<_jsonspot_root>' + xml + '</_jsonspot_root>';
  }

  function isLikelyXML(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    if (trimmed.length === 0 || trimmed.length > SIZE_LIMIT) return false;
    if (trimmed[0] !== '<') return false;

    // Try strict XML parsing first (handles proper XML/XHTML)
    try {
      const wrapped = prepareXMLForValidation(trimmed);
      const parser = new DOMParser();
      const doc = parser.parseFromString(wrapped, 'application/xml');
      if (!doc.querySelector('parsererror')) return true;
    } catch {
      // Fall through to lenient check
    }

    // Lenient fallback: detect well-formed HTML/XHTML output (e.g. XSLT results)
    // that isn't strict XML (void elements like <meta>, <br> without self-closing slash).
    // Must have at least one opening+closing tag pair to distinguish from random text.
    if (/<[a-zA-Z][^>]*>[\s\S]*<\/[a-zA-Z][^>]*>/.test(trimmed)) {
      return true;
    }

    return false;
  }

  function formatXMLString(xml, indent) {
    const indentStr = typeof indent === 'number' ? ' '.repeat(indent) : String(indent);
    let stripped = xml.replace(/(>)\s+(<)/g, '$1$2');
    // Tokenize: CDATA, comments, processing instructions, doctype, tags, text
    const tokens = stripped.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<[^>]+>|[^<]+/gi);
    if (!tokens) return xml;

    let formatted = '';
    let depth = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.startsWith('<?')) {
        formatted += indentStr.repeat(depth) + token + '\n';
      } else if (token.startsWith('<!--')) {
        formatted += indentStr.repeat(depth) + token + '\n';
      } else if (token.startsWith('<![CDATA[')) {
        formatted += indentStr.repeat(depth) + token + '\n';
      } else if (/^<!DOCTYPE/i.test(token)) {
        // DOCTYPE declaration (no depth change)
        formatted += indentStr.repeat(depth) + token + '\n';
      } else if (token.startsWith('</')) {
        depth = Math.max(0, depth - 1);
        formatted += indentStr.repeat(depth) + token + '\n';
      } else if (token.startsWith('<') && token.endsWith('/>')) {
        formatted += indentStr.repeat(depth) + token + '\n';
      } else if (token.startsWith('<')) {
        formatted += indentStr.repeat(depth) + token + '\n';
        depth++;
      } else {
        const trimmedText = token.trim();
        if (trimmedText) {
          formatted += indentStr.repeat(depth) + trimmedText + '\n';
        }
      }
    }
    return formatted.trimEnd();
  }

  function minifyXMLString(xml) {
    return xml
      .replace(/>\s+</g, '><')
      .replace(/^\s+|\s+$/g, '')
      .replace(/\s{2,}/g, ' ');
  }

  // ── Unified Detection ──────────────────────────────────
  function detectContentType(text) {
    if (isLikelyJSON(text)) return 'json';
    if (isLikelyXML(text)) return 'xml';
    return null;
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
    const contentType = detectContentType(clean);

    if (contentType === 'json') {
      try {
        const parsed = JSON.parse(clean);
        const formatted = action === 'format'
          ? JSON.stringify(parsed, null, indent)
          : JSON.stringify(parsed);
        setEditorValue(el, editorType, formatted);
        return { success: true, contentType: 'json' };
      } catch (e) {
        return { success: false, error: 'Invalid JSON: ' + e.message };
      }
    }

    if (contentType === 'xml') {
      const result = action === 'format'
        ? formatXMLString(clean, indent)
        : minifyXMLString(clean);
      if (result) {
        setEditorValue(el, editorType, result);
        return { success: true, contentType: 'xml' };
      }
      return { success: false, error: 'Invalid XML' };
    }

    return { success: false, error: 'No valid JSON or XML found' };
  }

  // ── Message Listener ───────────────────────────────────
  // Uses window.postMessage for cross-world communication (MAIN <-> ISOLATED).
  // The element is identified via data-jsonspot-id attribute on the DOM.

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== 'jsonspot-content') return;

    if (msg.type === 'jsonspot-request') {
      const { requestId, editorType, action, indent } = msg;
      console.log('[JSON Spot] Request received:', { requestId, editorType, action, indent });
      let result;

      try {
        const el = document.querySelector(`[data-jsonspot-id="${requestId}"]`);
        if (!el) throw new Error('Element not found');
        console.log('[JSON Spot] Found element:', el.tagName, el.className);
        result = handleEditor(el, editorType, action, indent || 2);
        console.log('[JSON Spot] Result:', result.success ? 'success' : 'failed', result.contentType || '', result.error || '');
      } catch (err) {
        console.log('[JSON Spot] Error:', err.message);
        result = { success: false, error: err.message };
      }

      window.postMessage({
        source: 'jsonspot-page',
        type: 'jsonspot-response',
        requestId, ...result
      }, '*');
    }

    if (msg.type === 'jsonspot-check') {
      const { requestId, editorType } = msg;
      console.log('[JSON Spot] Check received:', { requestId, editorType });
      let result;

      try {
        const el = document.querySelector(`[data-jsonspot-id="${requestId}"]`);
        if (!el) throw new Error('Element not found');
        const value = getEditorValue(el, editorType);
        const contentType = detectContentType(value);
        result = { contentType };
        console.log('[JSON Spot] Check result: contentType =', contentType, 'valueLength =', value?.length);
      } catch (err) {
        console.log('[JSON Spot] Check error:', err.message);
        result = { contentType: null };
      }

      window.postMessage({
        source: 'jsonspot-page',
        type: 'jsonspot-check-response',
        requestId, ...result
      }, '*');
    }
  });
})();
