(() => {
  'use strict';

  const JSON_SIZE_LIMIT = 5 * 1024 * 1024;
  let lastFocusedElement = null;

  // ── Focus Tracking ─────────────────────────────────────
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el.tagName === 'TEXTAREA' || el.isContentEditable) {
      lastFocusedElement = el;
    }
  }, true);

  document.addEventListener('mousedown', (e) => {
    const el = e.target;
    const editor = findParentEditor(el);
    if (editor) {
      lastFocusedElement = editor;
    }
  }, true);

  // ── JSON Detection ─────────────────────────────────────
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

  function processJSON(text, action, indent = 2) {
    if (!text) return null;
    const clean = text.replace(/^\uFEFF/, '').trim();
    try {
      const parsed = JSON.parse(clean);
      return action === 'format'
        ? JSON.stringify(parsed, null, indent)
        : JSON.stringify(parsed);
    } catch {
      return null;
    }
  }

  // ── Element Handlers ───────────────────────────────────
  function setTextareaValue(textarea, newValue) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    ).set;
    setter.call(textarea, newValue);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function handleTextarea(textarea, action) {
    const processed = processJSON(textarea.value, action);
    if (processed !== null) {
      setTextareaValue(textarea, processed);
    }
  }

  function handleContentEditable(element, action) {
    const processed = processJSON(element.textContent, action);
    if (processed !== null) {
      element.textContent = processed;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ── Editor Detection ───────────────────────────────────
  function findParentEditor(el) {
    let current = el;
    while (current && current !== document.body) {
      if (current.classList &&
          (current.classList.contains('CodeMirror') ||
           current.classList.contains('cm-editor') ||
           current.classList.contains('monaco-editor') ||
           current.classList.contains('ace_editor'))) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  // ── Action Dispatch ────────────────────────────────────
  function handleFormatAction(action) {
    let el = document.activeElement;

    // Fallback to last focused element if active is body/html
    if (!el || el === document.body || el === document.documentElement) {
      el = lastFocusedElement;
    }

    if (!el) return;

    if (el.tagName === 'TEXTAREA') {
      handleTextarea(el, action);
      return;
    }

    if (el.isContentEditable) {
      handleContentEditable(el, action);
      return;
    }

    // Check if active element is inside or is a code editor
    const editorEl = findParentEditor(el) || (el.classList && findParentEditor(el));
    if (editorEl) {
      // Editor support handled in v0.3.0 via page-script bridge
      return;
    }

    // Last resort: check lastFocusedElement
    if (lastFocusedElement) {
      if (lastFocusedElement.tagName === 'TEXTAREA') {
        handleTextarea(lastFocusedElement, action);
      } else if (lastFocusedElement.isContentEditable) {
        handleContentEditable(lastFocusedElement, action);
      }
    }
  }

  // ── Message Listener ───────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'JSONSPOT_CONTEXT_MENU') {
      handleFormatAction(message.action);
    }
  });
})();
