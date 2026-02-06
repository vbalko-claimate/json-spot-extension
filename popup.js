(() => {
  'use strict';

  const indentRadios = document.querySelectorAll('input[name="indent"]');
  const autoDetectCheckbox = document.getElementById('autoDetect');
  const versionSpan = document.querySelector('.version');
  const reloadNotice = document.getElementById('reloadNotice');
  const reloadBtn = document.getElementById('reloadBtn');
  const highlightBtn = document.getElementById('highlightBtn');
  const pickerBtn = document.getElementById('pickerBtn');

  // Show version from manifest
  const manifest = chrome.runtime.getManifest();
  versionSpan.textContent = `v${manifest.version}`;

  // Load saved settings
  chrome.storage.sync.get({ indent: 2, autoDetect: true }, (settings) => {
    const indentValue = settings.indent === '\t' ? 'tab' : String(settings.indent);
    indentRadios.forEach(radio => {
      radio.checked = radio.value === indentValue;
    });
    autoDetectCheckbox.checked = settings.autoDetect;
  });

  // Save on change
  indentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const value = radio.value === 'tab' ? '\t' : Number(radio.value);
      chrome.storage.sync.set({ indent: value });
    });
  });

  autoDetectCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ autoDetect: autoDetectCheckbox.checked });
  });

  // ── Ping content script to check if active ────────────
  let activeTabId = null;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    activeTabId = tabs[0].id;

    chrome.tabs.sendMessage(activeTabId, { type: 'JSONSPOT_PING' })
      .then((response) => {
        if (!response || !response.alive) throw new Error('No response');
        // Content script is active — buttons stay enabled
      })
      .catch(() => {
        // Content script not injected — show reload notice, disable actions
        reloadNotice.style.display = 'flex';
        highlightBtn.classList.add('disabled');
        pickerBtn.classList.add('disabled');
      });
  });

  reloadBtn.addEventListener('click', () => {
    if (activeTabId) {
      chrome.tabs.reload(activeTabId);
      window.close();
    }
  });

  // ── Highlight JSON button ─────────────────────────────
  highlightBtn.addEventListener('click', () => {
    if (!activeTabId || highlightBtn.classList.contains('disabled')) return;

    chrome.tabs.sendMessage(activeTabId, { type: 'JSONSPOT_HIGHLIGHT' })
      .then((response) => {
        if (response && response.count > 0) {
          highlightBtn.textContent = `Highlighted ${response.count} element${response.count > 1 ? 's' : ''}`;
        } else {
          highlightBtn.textContent = 'No JSON or XML found';
        }
        setTimeout(() => {
          highlightBtn.innerHTML = '<span class="action-icon">&#9673;</span> Highlight Elements';
        }, 2000);
      })
      .catch(() => {
        // Content script not available
      });
  });

  // ── Pick Element button ───────────────────────────────
  pickerBtn.addEventListener('click', () => {
    if (!activeTabId || pickerBtn.classList.contains('disabled')) return;

    chrome.tabs.sendMessage(activeTabId, { type: 'JSONSPOT_PICKER_START' })
      .then((response) => {
        if (response && response.started) {
          window.close(); // Close popup so user can interact with page
        }
      })
      .catch(() => {
        // Content script not available
      });
  });
})();
