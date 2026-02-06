chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'jsonspot-format',
    title: 'Format JSON',
    contexts: ['editable', 'page']
  });

  chrome.contextMenus.create({
    id: 'jsonspot-minify',
    title: 'Minify JSON',
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
