(() => {
  'use strict';

  const JSON_SIZE_LIMIT = 5 * 1024 * 1024;
  const SCAN_DEBOUNCE_MS = 500;
  const INPUT_DEBOUNCE_MS = 1000;

  // ── Settings Cache ─────────────────────────────────────
  let cachedSettings = { indent: 2, autoDetect: true };

  chrome.storage.sync.get({ indent: 2, autoDetect: true }, (settings) => {
    cachedSettings = settings;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.indent) cachedSettings.indent = changes.indent.newValue;
    if (changes.autoDetect) {
      cachedSettings.autoDetect = changes.autoDetect.newValue;
      if (!cachedSettings.autoDetect) {
        removeFloatingButton();
      }
    }
  });

  function getIndent() {
    return cachedSettings.indent || 2;
  }

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
  let pickerActive = false;
  let pickerOverlay = null;
  let pickerHighlight = null;
  let pickerCurrentElement = null;

  // ── Focus Tracking ─────────────────────────────────────
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    // Check if this element is inside a code editor FIRST
    // (e.g. Ace's internal <textarea class="ace_text-input">)
    const editor = findParentEditor(el);
    if (editor) {
      lastFocusedElement = editor;
      scheduleShowButton(editor);
      return;
    }
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
      scheduleShowButton(editor);
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

  function processJSON(text, action, indent) {
    if (indent === undefined) indent = getIndent();
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

    console.log('[JSON Spot] handleFormatAction:', action, 'element:', el.tagName, el.className);

    // Check for code editor parent FIRST (before textarea check)
    // This handles Ace/CM/Monaco internal elements correctly
    const editorEl = findParentEditor(el);
    if (editorEl) {
      console.log('[JSON Spot] Found parent editor:', editorEl.className);
      handleEditorViaPageScript(editorEl, action);
      return;
    }

    // Then check standalone textareas/contenteditable
    if (el.tagName === 'TEXTAREA') {
      if (handleTextarea(el, action)) updateButtonState(el, action);
      return;
    }

    if (el.isContentEditable) {
      if (handleContentEditable(el, action)) updateButtonState(el, action);
      return;
    }

    // Fallback to lastFocusedElement
    if (lastFocusedElement && lastFocusedElement !== el) {
      const lastEditor = findParentEditor(lastFocusedElement);
      if (lastEditor) {
        handleEditorViaPageScript(lastEditor, action);
      } else if (lastFocusedElement.tagName === 'TEXTAREA') {
        if (handleTextarea(lastFocusedElement, action)) updateButtonState(lastFocusedElement, action);
      } else if (lastFocusedElement.isContentEditable) {
        if (handleContentEditable(lastFocusedElement, action)) updateButtonState(lastFocusedElement, action);
      }
    }
  }

  // ── Page Script Bridge ──────────────────────────────────
  let requestIdCounter = 0;
  const pendingRequests = new Map();

  // NOTE: CustomEvent.detail does NOT cross world boundaries in Chrome MV3.
  // We pass data via data-* attributes on the target element instead.
  // Content script (ISOLATED) writes data-jsonspot-request, dispatches bare event.
  // Page script (MAIN) reads it, writes data-jsonspot-response, dispatches bare event.

  function handleEditorViaPageScript(editorEl, action) {
    const requestId = ++requestIdCounter;
    const editorType = getElementType(editorEl);
    if (!editorType) {
      console.log('[JSON Spot] No editor type for element:', editorEl.tagName, editorEl.className);
      return;
    }

    // Write request params to dataset (readable cross-world)
    editorEl.dataset.jsonspotRequest = JSON.stringify({
      requestId, editorType, action, indent: getIndent()
    });
    console.log('[JSON Spot] Sending request:', { requestId, editorType, action });

    document.dispatchEvent(new CustomEvent('jsonspot-request'));

    pendingRequests.set(requestId, { element: editorEl, action });
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        console.log('[JSON Spot] Request timed out:', requestId);
        showNotification('Editor not responding');
      }
    }, 3000);
  }

  function checkEditorJSON(editorEl, callback) {
    const requestId = ++requestIdCounter;
    const editorType = getElementType(editorEl);
    if (!editorType) { callback(false); return; }

    // Write check params to dataset
    editorEl.dataset.jsonspotCheck = JSON.stringify({ requestId, editorType });

    document.dispatchEvent(new CustomEvent('jsonspot-check'));

    pendingRequests.set(requestId, { callback });
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        callback(false);
      }
    }, 3000);
  }

  document.addEventListener('jsonspot-response', () => {
    // Read response from the element's dataset
    const el = document.querySelector('[data-jsonspot-response]');
    if (!el) return;

    let data;
    try {
      data = JSON.parse(el.dataset.jsonspotResponse);
    } catch {
      return;
    }
    delete el.dataset.jsonspotResponse;

    const { requestId, success, error } = data;
    console.log('[JSON Spot] Response received:', { requestId, success, error });
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);

    if (success && pending.element) {
      updateButtonState(pending.element, pending.action);
    } else if (error) {
      showNotification(error);
    }
  });

  document.addEventListener('jsonspot-check-response', () => {
    const el = document.querySelector('[data-jsonspot-check-response]');
    if (!el) return;

    let data;
    try {
      data = JSON.parse(el.dataset.jsonspotCheckResponse);
    } catch {
      return;
    }
    delete el.dataset.jsonspotCheckResponse;

    const { requestId, isJSON } = data;
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);

    if (pending.callback) {
      pending.callback(isJSON);
    }
  });

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
      .jsonspot-notification.success {
        background: #4CAF50;
      }
      .jsonspot-picker-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: auto;
        cursor: crosshair;
        z-index: 2147483647;
        background: rgba(76, 175, 80, 0.03);
      }
      .jsonspot-picker-highlight {
        position: fixed;
        pointer-events: none;
        border: 2px solid #4CAF50;
        background: rgba(76, 175, 80, 0.1);
        border-radius: 2px;
        z-index: 2147483647;
        transition: top 0.05s, left 0.05s, width 0.05s, height 0.05s;
      }
      .jsonspot-picker-label {
        position: fixed;
        pointer-events: none;
        background: #4CAF50;
        color: #fff;
        font-size: 11px;
        font-family: system-ui, -apple-system, sans-serif;
        padding: 2px 6px;
        border-radius: 2px;
        z-index: 2147483647;
        white-space: nowrap;
      }
      .jsonspot-picker-hint {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        background: rgba(0,0,0,0.8);
        color: #fff;
        font-size: 13px;
        font-family: system-ui, -apple-system, sans-serif;
        padding: 8px 16px;
        border-radius: 8px;
        z-index: 2147483647;
        white-space: nowrap;
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

  function showNotification(message, type = 'error') {
    if (!shadowRoot) return;
    const note = document.createElement('div');
    note.className = 'jsonspot-notification' + (type === 'success' ? ' success' : '');
    note.textContent = message;
    note.style.top = '10px';
    note.style.right = '10px';
    shadowRoot.appendChild(note);
    setTimeout(() => note.remove(), 3000);
  }

  // ── Auto-Detection & Scanning ──────────────────────────
  function scheduleShowButton(el) {
    if (!shadowRoot) return;
    if (!cachedSettings.autoDetect) return;
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
    } else {
      // Code editor: ask page script to check
      checkEditorJSON(el, (isJSON) => {
        if (isJSON) {
          showFloatingButton(el, type);
        } else if (currentTargetElement === el) {
          removeFloatingButton();
        }
      });
    }
  }

  function scanForJSONElements() {
    if (!shadowRoot) return;

    // Scan textareas (skip editor-internal ones like Ace's ace_text-input)
    document.querySelectorAll('textarea').forEach(el => {
      if (el.classList.contains('ace_text-input')) return;
      if (findParentEditor(el)) return;
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

    // Scan code editors
    document.querySelectorAll('.CodeMirror, .cm-editor, .monaco-editor, .ace_editor').forEach(el => {
      if (dismissedElements.has(el)) return;
      if (el === lastFocusedElement) {
        scheduleShowButton(el);
      }
    });

    reportBadgeCount();
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

  // ── Badge Reporting ─────────────────────────────────────
  function reportBadgeCount() {
    let count = 0;

    document.querySelectorAll('textarea').forEach(el => {
      if (el.classList.contains('ace_text-input')) return;
      if (findParentEditor(el)) return;
      if (isLikelyJSON(el.value)) count++;
    });
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      if (isLikelyJSON(el.textContent)) count++;
    });
    // Code editors are counted by class presence (we can't synchronously check their content)
    count += document.querySelectorAll('.CodeMirror, .cm-editor, .monaco-editor, .ace_editor').length;

    try {
      chrome.runtime.sendMessage({ type: 'JSONSPOT_UPDATE_BADGE', count });
    } catch {
      // Extension context may be invalidated
    }
  }

  // ── Highlight Animation ─────────────────────────────────
  const HIGHLIGHT_DURATION_MS = 3000;

  function collectJSONElements() {
    const results = [];

    // Textareas (skip editor-internal)
    document.querySelectorAll('textarea').forEach(el => {
      if (el.classList.contains('ace_text-input')) return;
      if (findParentEditor(el)) return;
      if (isLikelyJSON(el.value)) results.push(el);
    });

    // Contenteditable
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      if (isLikelyJSON(el.textContent)) results.push(el);
    });

    // Code editors (counted by presence — same heuristic as badge)
    document.querySelectorAll('.CodeMirror, .cm-editor, .monaco-editor, .ace_editor').forEach(el => {
      results.push(el);
    });

    return results;
  }

  function highlightJSONElements() {
    const elements = collectJSONElements();
    elements.forEach((el, i) => applyHighlight(el, i === 0));
    return elements.length;
  }

  function applyHighlight(el, scrollTo = false) {
    const origOutline = el.style.outline;
    const origBoxShadow = el.style.boxShadow;
    const origTransition = el.style.transition;

    el.style.transition = 'outline-color 0.3s, box-shadow 0.3s';
    el.style.outline = '2px solid #4CAF50';
    el.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';

    if (scrollTo) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Fade out and restore
    setTimeout(() => {
      el.style.outline = '2px solid transparent';
      el.style.boxShadow = 'none';
      setTimeout(() => {
        el.style.outline = origOutline;
        el.style.boxShadow = origBoxShadow;
        el.style.transition = origTransition;
      }, 300);
    }, HIGHLIGHT_DURATION_MS);
  }

  // ── Picker Mode ────────────────────────────────────────

  function startPickerMode() {
    if (pickerActive) return;
    pickerActive = true;

    if (!shadowRoot) initFloatingButton();

    // Create overlay to capture all mouse events
    pickerOverlay = document.createElement('div');
    pickerOverlay.className = 'jsonspot-picker-overlay';
    shadowRoot.appendChild(pickerOverlay);

    // Create highlight box (invisible until hover)
    pickerHighlight = document.createElement('div');
    pickerHighlight.className = 'jsonspot-picker-highlight';
    pickerHighlight.style.display = 'none';
    shadowRoot.appendChild(pickerHighlight);

    // Create label (shows element tag/type)
    const pickerLabel = document.createElement('div');
    pickerLabel.className = 'jsonspot-picker-label';
    pickerLabel.style.display = 'none';
    shadowRoot.appendChild(pickerLabel);

    // Create hint bar at bottom
    const pickerHint = document.createElement('div');
    pickerHint.className = 'jsonspot-picker-hint';
    pickerHint.textContent = 'Click an element containing JSON \u00b7 Esc to cancel';
    shadowRoot.appendChild(pickerHint);

    // Mousemove: find element under cursor, highlight it
    pickerOverlay.addEventListener('mousemove', (e) => {
      // Temporarily hide overlay to get element beneath it
      pickerOverlay.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      pickerOverlay.style.pointerEvents = 'auto';

      if (!el || el === shadowHost || shadowHost.contains(el)) {
        pickerHighlight.style.display = 'none';
        pickerLabel.style.display = 'none';
        pickerCurrentElement = null;
        return;
      }

      // Walk up to find a meaningful target
      const target = findPickerTarget(el);
      pickerCurrentElement = target;

      const rect = target.getBoundingClientRect();
      pickerHighlight.style.display = 'block';
      pickerHighlight.style.top = rect.top + 'px';
      pickerHighlight.style.left = rect.left + 'px';
      pickerHighlight.style.width = rect.width + 'px';
      pickerHighlight.style.height = rect.height + 'px';

      // Show label
      pickerLabel.style.display = 'block';
      pickerLabel.textContent = describeElement(target);
      pickerLabel.style.top = Math.max(0, rect.top - 20) + 'px';
      pickerLabel.style.left = rect.left + 'px';
    });

    // Click: select the element
    pickerOverlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (pickerCurrentElement) {
        handlePickedElement(pickerCurrentElement);
      }
      stopPickerMode();
    });

    // Escape key: cancel
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopPickerMode();
      }
    };
    document.addEventListener('keydown', escHandler, true);

    // Store escHandler reference for cleanup
    pickerOverlay._escHandler = escHandler;
  }

  function stopPickerMode() {
    if (!pickerActive) return;
    pickerActive = false;

    if (pickerOverlay && pickerOverlay._escHandler) {
      document.removeEventListener('keydown', pickerOverlay._escHandler, true);
    }

    // Remove all picker UI elements from shadow root
    shadowRoot.querySelectorAll(
      '.jsonspot-picker-overlay, .jsonspot-picker-highlight, .jsonspot-picker-label, .jsonspot-picker-hint'
    ).forEach(el => el.remove());

    pickerOverlay = null;
    pickerHighlight = null;
    pickerCurrentElement = null;
  }

  function findPickerTarget(el) {
    // Priority 1: Check if element is inside a code editor
    const editor = findParentEditor(el);
    if (editor) return editor;

    // Priority 2: Check if element is a textarea
    if (el.tagName === 'TEXTAREA') return el;

    // Priority 3: Check if element is or is inside contenteditable
    let current = el;
    while (current && current !== document.body) {
      if (current.isContentEditable && current.getAttribute('contenteditable') === 'true') {
        return current;
      }
      current = current.parentElement;
    }

    // Priority 4: Walk up to find a text-bearing element with JSON-like content
    current = el;
    while (current && current !== document.body) {
      const text = current.textContent?.trim();
      if (text && text.length > 1 && text.length < JSON_SIZE_LIMIT) {
        const firstChar = text[0];
        if (firstChar === '{' || firstChar === '[') {
          return current;
        }
      }
      current = current.parentElement;
    }

    // Fallback: return the original element
    return el;
  }

  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const editorEl = findParentEditor(el) || el;
    const type = getElementType(editorEl);
    if (type && type !== 'textarea' && type !== 'contenteditable') {
      const names = {
        codemirror5: 'CodeMirror 5',
        codemirror6: 'CodeMirror 6',
        monaco: 'Monaco Editor',
        ace: 'Ace Editor'
      };
      return names[type] || tag;
    }
    if (el.tagName === 'TEXTAREA') return 'textarea';
    if (el.isContentEditable) return 'contenteditable';
    if (el.id) return `${tag}#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const first = el.className.trim().split(/\s+/)[0];
      if (first) return `${tag}.${first}`;
    }
    return tag;
  }

  function handlePickedElement(el) {
    // Case 1: Code editor
    const editor = findParentEditor(el);
    if (editor) {
      handleEditorViaPageScript(editor, 'format');
      return;
    }

    // Case 2: Textarea
    if (el.tagName === 'TEXTAREA') {
      if (handleTextarea(el, 'format')) {
        showNotification('JSON formatted', 'success');
      } else {
        showNotification('No valid JSON found in this element');
      }
      return;
    }

    // Case 3: Contenteditable
    if (el.isContentEditable) {
      if (handleContentEditable(el, 'format')) {
        showNotification('JSON formatted', 'success');
      } else {
        showNotification('No valid JSON found in this element');
      }
      return;
    }

    // Case 4: Arbitrary element (<pre>, <code>, <div>, etc.)
    const text = el.textContent;
    if (text && isLikelyJSON(text)) {
      const formatted = processJSON(text, 'format');
      if (formatted !== null) {
        el.textContent = formatted;
        showNotification('JSON formatted', 'success');
        return;
      }
    }

    showNotification('No valid JSON found in this element');
  }

  // ── Message Listener ───────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'JSONSPOT_PING') {
      sendResponse({ alive: true });
      return;
    }
    if (message.type === 'JSONSPOT_HIGHLIGHT') {
      const count = highlightJSONElements();
      sendResponse({ count });
      return;
    }
    if (message.type === 'JSONSPOT_PICKER_START') {
      startPickerMode();
      sendResponse({ started: true });
      return;
    }
    if (message.type === 'JSONSPOT_CONTEXT_MENU' || message.type === 'JSONSPOT_KEYBOARD_SHORTCUT') {
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
