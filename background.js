let recordingTabId = null; 
let recording = false;


let allEvents = [];

function showNotification(title, message) {
  if (!chrome.notifications) return;
  chrome.notifications.create('', {
    type: 'basic',
    iconUrl: 'icon.png',
    title,
    message
  });
}

function exportRecording() {
  console.log('Currently stored (in memory) events:', allEvents);
  console.log(`Exporting ${allEvents.length} rrweb events.`);

  let json;
  try {
    json = JSON.stringify(allEvents, null, 2);
  } catch (err) {
    console.error('Failed to stringify rrweb events:', err);
    return;
  }

  const base64 = btoa(unescape(encodeURIComponent(json)));
  const dataUrl = `data:application/json;base64,${base64}`;

  chrome.downloads.download({
    url: dataUrl,
    filename: `rrweb-recording-${Date.now()}.json`,
    conflictAction: 'uniquify'
  }, () => {
    allEvents = [];
  });
}

function injectContentScript(tabId, callback) {
  console.log(`Injecting content script into tab ${tabId}...`);
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['dist/main.js'] // your compiled rrweb content script
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error injecting content script:', chrome.runtime.lastError.message);
    } else {
      console.log('Content script injected.');
    }
    if (callback) callback();
  });
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'contentScriptReady') {
    console.log(`Content script ready on tab ${sender.tab?.id}`);
    sendResponse({ status: 'ready' });
  }

  if (message.rrwebEvent) {
    allEvents.push(message.rrwebEvent);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-recording') return;

  chrome.storage.local.get({ recording: false }, (res) => {
    const wasRecording = res.recording;
    const nowRecording = !wasRecording;

    chrome.storage.local.set({ recording: nowRecording }, () => {
      console.log(`Recording: ${nowRecording}`);
    });

    showNotification(
      nowRecording ? 'Recording Started' : 'Recording Stopped',
      nowRecording
        ? 'Recording for this tab has started.'
        : 'Recording stopped.'
    );

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      const tabId = tabs[0].id;
      recordingTabId = nowRecording ? tabId : null;

      const action = nowRecording ? 'start' : 'stop';
      if (nowRecording) {
        injectContentScript(tabId, () => {
          chrome.tabs.sendMessage(tabId, { action }, (resp) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending start to content script:', chrome.runtime.lastError.message);
            } else {
              console.log(`Recording started on tab ${tabId}`);
            }
          });
        });
      } else {
        chrome.tabs.sendMessage(tabId, { action }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending stop to content script:', chrome.runtime.lastError.message);
          } else {
            console.log(`Recording stopped on tab ${tabId}`);
          }
          exportRecording();
        });
      }
    });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== recordingTabId) return;

  chrome.storage.local.get({ recording: false }, (res) => {
    if (!res.recording) return;

    if (changeInfo.status === 'complete') {
      console.log(`Tab ${tabId} loaded a new page. Re-injecting + "start".`);
      injectContentScript(tabId, () => {
        chrome.tabs.sendMessage(tabId, { action: 'start' }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error('Re-start recording error:', chrome.runtime.lastError.message);
          } else {
            console.log('Recording resumed on new page in tab', tabId);
          }
        });
      });
    }
  });
});
