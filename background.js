chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'jsonspot-format',
    title: 'Format JSON / XML',
    contexts: ['editable', 'page']
  });

  chrome.contextMenus.create({
    id: 'jsonspot-minify',
    title: 'Minify JSON / XML',
    contexts: ['editable', 'page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'jsonspot-format' || info.menuItemId === 'jsonspot-minify') {
    const action = info.menuItemId === 'jsonspot-format' ? 'format' : 'minify';
    chrome.tabs.sendMessage(tab.id, {
      type: 'JSONSPOT_CONTEXT_MENU',
      action
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'JSONSPOT_UPDATE_BADGE' && sender.tab) {
    const count = message.count;
    const text = count > 0 ? String(count) : '';
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: sender.tab.id });
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'format-json') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'JSONSPOT_KEYBOARD_SHORTCUT',
      action: 'format'
    });
  }
});
