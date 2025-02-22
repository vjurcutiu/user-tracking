importScripts('pako.min.js');

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

  try {
    // Compress the JSON string using pako.gzip
    const compressed = pako.gzip(json);
    // Convert the compressed data (Uint8Array) to a binary string
    let binaryString = '';
    for (let i = 0; i < compressed.length; i++) {
      binaryString += String.fromCharCode(compressed[i]);
    }
    // Encode the binary string to base64
    const base64 = btoa(binaryString);
    // Create a data URL with appropriate MIME type
    const dataUrl = `data:application/octet-stream;base64,${base64}`;

    chrome.downloads.download({
      url: dataUrl,
      // Use .json.gz to indicate that the file is compressed
      filename: `rrweb-recording-${Date.now()}.json.gz`,
      conflictAction: 'uniquify'
    }, () => {
      allEvents = [];
    });
  } catch (compressionError) {
    console.error('Compression failed:', compressionError);
  }
}

function exportLiteRecording(tabId) {  
  chrome.tabs.sendMessage(tabId, { action: "exportLite" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      console.error('Error retrieving lite events:', chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No response received');
      return;
    }

    console.log("Received lite events from content script:", response.liteEvents);

    let json;
    try {
      json = JSON.stringify(response.liteEvents, null, 2);
    } catch (err) {
      console.error('Failed to stringify LITE events:', err);
      return;
    }
      
    try {      
      // Encode the binary string to base64
      const base64 = btoa(json);
      // Create a data URL with appropriate MIME type
      const dataUrl = `data:application/octet-stream;base64,${base64}`;

      chrome.downloads.download({
          url: dataUrl,
          filename: `lite-recording-${Date.now()}.json`,
          conflictAction: 'uniquify'
      }, () => {
          chrome.tabs.sendMessage(tabId, { action: "clearLiteEvents" });
      });
    } catch (liteExportError) {
      console.error('Compression failed:', liteExportError);
    }
  });
}

function injectContentScript(tabId, callback) {
  console.log(`Injecting content script into tab ${tabId}...`);
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['dist/main.js'] 
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
          exportLiteRecording(tabId);
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
