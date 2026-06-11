chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL("index.html");
  chrome.tabs.query({ url }, (tabs) => {
    if (tabs.length > 0 && tabs[0].id !== undefined) {
      chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId !== undefined) {
        chrome.windows.update(tabs[0].windowId, { focused: true });
      }
      return;
    }
    chrome.tabs.create({ url });
  });
});
