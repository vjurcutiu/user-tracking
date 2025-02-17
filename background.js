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

function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      (match, p1) => String.fromCharCode('0x' + p1)
    )
  );
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

    try {
      const base64Data = b64EncodeUnicode(json);  
      const dataUrl = `data:application/json;base64,${base64Data}`;
    
      chrome.downloads.download({
        url: dataUrl,
        filename: `recording-${Date.now()}.json`,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError.message);
        } else {
          console.log('Download started with ID:', downloadId);
        }
    
        // No need to revoke anything for a data URL, but you can clear
        // chrome.storage or do any other cleanup here
        chrome.storage.local.set({ records: [], initialDomSnapshot: '', domMutations: [] }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error clearing storage:', chrome.runtime.lastError.message);
          } else {
            console.log('Storage cleared.');
          }
        });
      });
    } catch (err) {
      console.error('Failed to create data URL:', err);
    }
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
  if (command !== "toggle-recording") return;

  chrome.storage.local.get({ recording: false }, (result) => {
    const wasRecording = result.recording;
    const nowRecording = !wasRecording;

    console.log(`Recording ${nowRecording ? "started" : "stopped"}.`);

    // Persist the new state
    chrome.storage.local.set({ recording: nowRecording }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error updating recording state:", chrome.runtime.lastError.message);
      }
    });

    // Show notification
    showNotification(
      nowRecording ? "Recording Started" : "Recording Stopped",
      nowRecording
        ? "User interaction recording has started."
        : "User interaction recording has stopped."
    );

    // Query the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError.message);
        return;
      }

      if (!tabs.length || !tabs[0].id) {
        console.warn('No active tab found.');
        return;
      }

      const tabId = tabs[0].id;
      const action = nowRecording ? "start" : "stop";

      // Always inject content script (only needed if you do NOT auto-declare it in manifest.json)
      // If you declare your content script in "content_scripts" in the manifest,
      // you could skip injection or at least skip for "stop".
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["dist/main.js"], 
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error injecting content script:", chrome.runtime.lastError.message);
          return;
        }
        console.log("Content script injected (or already present).");

        // Now send "start"/"stop" to the content script
        chrome.tabs.sendMessage(tabId, { action }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
          } else {
            console.log(`Message '${action}' sent. Response:`, response);
          }

          // If we're stopping, export
          if (!nowRecording) {
            exportRecording();
          }
        });
      });
    });
  });
});