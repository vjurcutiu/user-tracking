let recording = false;

function showNotification(title, message) {
  if (!chrome.notifications) {
    console.error('chrome.notifications API is not available.');
    return;
  }
  chrome.notifications.create('', {
    type: 'basic',
    iconUrl: 'icon.png', // Ensure you have an icon.png in your extension folder
    title: title,
    message: message,
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('Notification error:', chrome.runtime.lastError.message);
    } else {
      console.log('Notification shown with ID:', notificationId);
    }
  });
}

function exportRecording() {
  // Retrieve stored interaction data, initial DOM snapshot, and DOM mutations
  chrome.storage.local.get({ 
    records: [], 
    initialDomSnapshot: '', 
    domMutations: [] 
  }, (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error retrieving storage data:', chrome.runtime.lastError.message);
      return;
    }
    
    const exportData = {
      interactions: result.records,
      initialDomSnapshot: result.initialDomSnapshot,
      domMutations: result.domMutations
    };

    let json;
    try {
      json = JSON.stringify(exportData, null, 2);
    } catch (err) {
      console.error('Error stringifying export data:', err);
      return;
    }

    let blob;
    try {
      blob = new Blob([json], { type: 'application/json' });
    } catch (err) {
      console.error('Error creating Blob:', err);
      return;
    }

    let url;
    try {
      // Use globalThis to ensure compatibility in the service worker context.
      url = globalThis.URL.createObjectURL(blob);
    } catch (err) {
      console.error('Failed to create Object URL for the blob:', err);
      return;
    }

    if (!url) {
      console.error('Failed to create Object URL for the blob.');
      return;
    }

    chrome.downloads.download({
      url: url,
      filename: `recording-${Date.now()}.json`,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError.message);
      } else {
        console.log('Download started with ID:', downloadId);
      }
      setTimeout(() => {
        globalThis.URL.revokeObjectURL(url);
        console.log('Object URL revoked.');
      }, 5000);
      
      chrome.storage.local.set({ records: [], initialDomSnapshot: '', domMutations: [] }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing storage:', chrome.runtime.lastError.message);
        } else {
          console.log('Storage cleared.');
        }
      });
    });
  });
}

function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']  // Ensure this path is correct relative to your manifest
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error injecting content script:', chrome.runtime.lastError.message);
    } else {
      console.log('Content script injected successfully.');
    }
    if (callback) callback();
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contentScriptReady") {
    console.log("Content script reported ready from tab:", sender.tab?.id);
    sendResponse({ status: "ready" });
    return; // Prevent further processing in this listener
  }

  if (message.interactionData) {
    const { interactionData, domSnapshot } = message;
    console.log('Interaction:', interactionData);
    console.log('DOM Snapshot:', domSnapshot);

    chrome.storage.local.get({ records: [] }, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving records:', chrome.runtime.lastError.message);
        return;
      }
      const records = result.records;
      records.push({ interactionData, domSnapshot });
      chrome.storage.local.set({ records }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving records:', chrome.runtime.lastError.message);
        } else {
          console.log('Record saved successfully.');
        }
      });
    });
    sendResponse({ status: 'success' });
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-recording") {
    recording = !recording;
    console.log(`Recording ${recording ? "started" : "stopped"}.`);

    showNotification(
      recording ? "Recording Started" : "Recording Stopped",
      recording ? "User interaction recording has started." : "User interaction recording has stopped."
    );

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError.message);
        return;
      }
      if (tabs.length && tabs[0].id) {
        console.log("Active tab URL:", tabs[0].url);
        // Delay a little to allow content script readiness
        setTimeout(() => {
          chrome.tabs.sendMessage(tabs[0].id, { action: recording ? "start" : "stop" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message to content script:', chrome.runtime.lastError.message);
              // Attempt to inject the content script, then retry
              injectContentScript(tabs[0].id, () => {
                // Retry after a short delay
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabs[0].id, { action: recording ? "start" : "stop" }, (retryResponse) => {
                    if (chrome.runtime.lastError) {
                      console.error('Retry error sending message:', chrome.runtime.lastError.message);
                    } else {
                      console.log('Message sent to content script after injection, response:', retryResponse);
                    }
                  });
                }, 300);
              });
            } else {
              console.log('Message sent to content script, response:', response);
            }
          });
        }, 300);
      } else {
        console.warn('No active tab found.');
      }
    });

    if (!recording) {
      exportRecording();
    }
  }
});
