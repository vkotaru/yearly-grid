// Toolbar click → open the year grid in a tab, or focus it if already open.
// runtime.getContexts finds our own page without needing the "tabs" permission.

const PAGE = chrome.runtime.getURL('index.html');

chrome.action.onClicked.addListener(async () => {
  const [existing] = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.TAB],
    documentUrls: [PAGE],
  });
  if (existing && existing.tabId !== -1) {
    await chrome.tabs.update(existing.tabId, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: PAGE });
  }
});
