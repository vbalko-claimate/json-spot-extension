(() => {
  'use strict';

  const JSON_SIZE_LIMIT = 5 * 1024 * 1024;
  const SCAN_DEBOUNCE_MS = 500;
  const INPUT_DEBOUNCE_MS = 1000;

  let lastFocusedElement = null;
  let shadowHost = null;
  let shadowRoot = null;
  let currentButton = null;
  let currentTargetElement = null;
  let currentFormatState = 'format'; // 'format' or 'minify'
  let rescanTimer = null;
  let inputDebounceTimers = new WeakMap();
  const dismissedElements = new WeakSet();
  const trackedTextareas = new WeakSet();

  // ── Focus Tracking ─────────────────────────────────────
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el.tagName === 'TEXTAREA' || el.isContentEditable) {
      lastFocusedElement = el;
      scheduleShowButton(el);
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

  function getElementText(el) {
    if (el.tagName === 'TEXTAREA') return el.value;
    if (el.isContentEditable) return el.textContent;
    return null;
  }

  function getElementType(el) {
    if (el.tagName === 'TEXTAREA') return 'textarea';
    if (el.isContentEditable) return 'contenteditable';
    if (el.classList) {
      if (el.classList.contains('CodeMirror')) return 'codemirror5';
      if (el.classList.contains('cm-editor')) return 'codemirror6';
      if (el.classList.contains('monaco-editor')) return 'monaco';
      if (el.classList.contains('ace_editor')) return 'ace';
    }
    return null;
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
      return true;
    }
    return false;
  }

  function handleContentEditable(element, action) {
    const processed = processJSON(element.textContent, action);
    if (processed !== null) {
      element.textContent = processed;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
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

    if (!el || el === document.body || el === document.documentElement) {
      el = lastFocusedElement;
    }

    if (!el) return;

    if (el.tagName === 'TEXTAREA') {
      if (handleTextarea(el, action)) updateButtonState(el, action);
      return;
    }

    if (el.isContentEditable) {
      if (handleContentEditable(el, action)) updateButtonState(el, action);
      return;
    }

    const editorEl = findParentEditor(el);
    if (editorEl) {
      handleEditorViaPageScript(editorEl, action);
      return;
    }

    if (lastFocusedElement) {
      if (lastFocusedElement.tagName === 'TEXTAREA') {
        if (handleTextarea(lastFocusedElement, action)) updateButtonState(lastFocusedElement, action);
      } else if (lastFocusedElement.isContentEditable) {
        if (handleContentEditable(lastFocusedElement, action)) updateButtonState(lastFocusedElement, action);
      } else {
        const editor = findParentEditor(lastFocusedElement);
        if (editor) handleEditorViaPageScript(editor, action);
      }
    }
  }

  // ── Page Script Bridge (stub for v0.3.0) ───────────────
  function handleEditorViaPageScript(editorEl, action) {
    // Will be implemented in v0.3.0
  }

  // ── Floating Button (Shadow DOM) ───────────────────────
  function initFloatingButton() {
    shadowHost = document.createElement('div');
    shadowHost.id = 'jsonspot-shadow-host';
    shadowHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
      }
      .jsonspot-btn {
        position: fixed;
        pointer-events: auto;
        background: #4CAF50;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 11px;
        font-family: system-ui, -apple-system, sans-serif;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        opacity: 0.75;
        transition: opacity 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        line-height: 1.4;
        z-index: 2147483647;
        user-select: none;
      }
      .jsonspot-btn:hover {
        opacity: 1;
        background: #43a047;
      }
      .jsonspot-dismiss {
        margin-left: 2px;
        opacity: 0.6;
        cursor: pointer;
        font-size: 10px;
        padding: 0 2px;
      }
      .jsonspot-dismiss:hover {
        opacity: 1;
      }
      .jsonspot-notification {
        position: fixed;
        pointer-events: auto;
        background: #f44336;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 11px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 2147483647;
        white-space: nowrap;
        line-height: 1.4;
      }
    `;
    shadowRoot.appendChild(style);
  }

  function showFloatingButton(targetElement, type) {
    if (dismissedElements.has(targetElement)) return;
    if (currentTargetElement === targetElement && currentButton) {
      repositionButton();
      return;
    }

    removeFloatingButton();

    const rect = targetElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    currentTargetElement = targetElement;
    currentFormatState = 'format';

    const btn = document.createElement('button');
    btn.className = 'jsonspot-btn';
    btn.innerHTML = '{ } Format <span class="jsonspot-dismiss">✕</span>';

    positionButton(btn, rect);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const action = currentFormatState;
      let success = false;

      if (type === 'textarea') {
        success = handleTextarea(targetElement, action);
      } else if (type === 'contenteditable') {
        success = handleContentEditable(targetElement, action);
      } else {
        handleEditorViaPageScript(targetElement, action);
        return;
      }

      if (success) {
        updateButtonState(targetElement, action);
      }
    });

    const dismissBtn = btn.querySelector('.jsonspot-dismiss');
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dismissedElements.add(targetElement);
      removeFloatingButton();
    });

    shadowRoot.appendChild(btn);
    currentButton = btn;
  }

  function positionButton(btn, rect) {
    btn.style.top = `${rect.top + 4}px`;
    btn.style.left = `${rect.right - 4}px`;
    btn.style.transform = 'translateX(-100%)';
  }

  function repositionButton() {
    if (!currentButton || !currentTargetElement) return;
    const rect = currentTargetElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      removeFloatingButton();
      return;
    }
    positionButton(currentButton, rect);
  }

  function removeFloatingButton() {
    if (currentButton && currentButton.parentNode) {
      currentButton.remove();
    }
    currentButton = null;
    currentTargetElement = null;
    currentFormatState = 'format';
  }

  function updateButtonState(el, lastAction) {
    if (currentTargetElement !== el || !currentButton) return;
    if (lastAction === 'format') {
      currentFormatState = 'minify';
      currentButton.innerHTML = '{ } Minify <span class="jsonspot-dismiss">✕</span>';
    } else {
      currentFormatState = 'format';
      currentButton.innerHTML = '{ } Format <span class="jsonspot-dismiss">✕</span>';
    }
    // Re-attach dismiss handler
    const dismissBtn = currentButton.querySelector('.jsonspot-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        dismissedElements.add(el);
        removeFloatingButton();
      });
    }
  }

  function showNotification(message) {
    if (!shadowRoot) return;
    const note = document.createElement('div');
    note.className = 'jsonspot-notification';
    note.textContent = message;
    note.style.top = '10px';
    note.style.right = '10px';
    shadowRoot.appendChild(note);
    setTimeout(() => note.remove(), 3000);
  }

  // ── Auto-Detection & Scanning ──────────────────────────
  function scheduleShowButton(el) {
    if (!shadowRoot) return;
    if (dismissedElements.has(el)) return;

    const type = getElementType(el);
    if (!type) return;

    if (type === 'textarea' || type === 'contenteditable') {
      const text = getElementText(el);
      if (isLikelyJSON(text)) {
        showFloatingButton(el, type);
      } else {
        if (currentTargetElement === el) removeFloatingButton();
      }
    }
    // Editor types will be handled in v0.3.0
  }

  function scanForJSONElements() {
    if (!shadowRoot) return;

    // Scan textareas
    document.querySelectorAll('textarea').forEach(el => {
      trackTextareaInput(el);
      if (dismissedElements.has(el)) return;
      if (isLikelyJSON(el.value)) {
        // Only show button for the focused one
        if (el === lastFocusedElement || el === document.activeElement) {
          showFloatingButton(el, 'textarea');
        }
      }
    });

    // Scan contenteditable
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      if (dismissedElements.has(el)) return;
      if (isLikelyJSON(el.textContent)) {
        if (el === lastFocusedElement || el === document.activeElement) {
          showFloatingButton(el, 'contenteditable');
        }
      }
    });
  }

  function trackTextareaInput(textarea) {
    if (trackedTextareas.has(textarea)) return;
    trackedTextareas.add(textarea);

    textarea.addEventListener('input', () => {
      // Debounce re-check on input
      let timer = inputDebounceTimers.get(textarea);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        inputDebounceTimers.delete(textarea);
        if (textarea === lastFocusedElement || textarea === document.activeElement) {
          scheduleShowButton(textarea);
        }
      }, INPUT_DEBOUNCE_MS);
      inputDebounceTimers.set(textarea, timer);
    });
  }

  function scheduleScan() {
    if (rescanTimer) clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => {
      rescanTimer = null;
      scanForJSONElements();
    }, SCAN_DEBOUNCE_MS);
  }

  // ── MutationObserver ───────────────────────────────────
  const observer = new MutationObserver((mutations) => {
    let shouldRescan = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node === shadowHost || shadowHost?.contains(node)) continue;
        if (node.tagName === 'TEXTAREA' ||
            node.getAttribute?.('contenteditable') === 'true' ||
            node.classList?.contains('CodeMirror') ||
            node.classList?.contains('cm-editor') ||
            node.classList?.contains('monaco-editor') ||
            node.classList?.contains('ace_editor') ||
            node.querySelector?.('textarea, [contenteditable="true"], .CodeMirror, .cm-editor, .monaco-editor, .ace_editor')) {
          shouldRescan = true;
          break;
        }
      }
      if (shouldRescan) break;
    }
    if (shouldRescan) scheduleScan();
  });

  // ── Scroll & Resize Handling ───────────────────────────
  let rafPending = false;
  function onScrollOrResize() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      repositionButton();
    });
  }

  // ── Message Listener ───────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'JSONSPOT_CONTEXT_MENU') {
      handleFormatAction(message.action);
    }
  });

  // ── Initialization ─────────────────────────────────────
  function init() {
    if (!document.body) return;
    initFloatingButton();
    scanForJSONElements();
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
