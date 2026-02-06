(() => {
  'use strict';

  const indentRadios = document.querySelectorAll('input[name="indent"]');
  const autoDetectCheckbox = document.getElementById('autoDetect');
  const versionSpan = document.querySelector('.version');

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
})();
