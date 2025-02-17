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

// Helper to handle UTF-8 safely in base64
function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      (match, p1) => String.fromCharCode('0x' + p1)
    )
  );
}

/**
 * Export the rrweb events to a JSON file using a data URL.
 * This function is called when the user stops recording.
 */
function exportRecording() {
  // Retrieve rrwebEvents from storage
  chrome.storage.local.get({ rrwebEvents: [] }, (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error retrieving rrweb events:', chrome.runtime.lastError.message);
      return;
    }
    
    const rrwebData = result.rrwebEvents || [];
    let json;
    try {
      // Convert events array to JSON
      json = JSON.stringify(rrwebData, null, 2);
    } catch (err) {
      console.error('Error stringifying rrweb events:', err);
      return;
    }

    // Base64-encode the JSON for a data URL
    try {
      const base64Data = b64EncodeUnicode(json);  
      const dataUrl = `data:application/json;base64,${base64Data}`;
    
      // Use the chrome.downloads API to save the file
      chrome.downloads.download({
        url: dataUrl,
        filename: `rrweb-recording-${Date.now()}.json`,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError.message);
        } else {
          console.log('Download started with ID:', downloadId);
        }

        // Optionally clear rrwebEvents after exporting
        chrome.storage.local.set({ rrwebEvents: [] }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error clearing rrwebEvents:', chrome.runtime.lastError.message);
          } else {
            console.log('rrweb events cleared from storage.');
          }
        });
      });
    } catch (err) {
      console.error('Failed to create data URL:', err);
    }
  });
}

/**
 * Dynamically injects the content script if it’s not in your manifest.json
 * "content_scripts" section. If you declared it in your manifest, you can skip
 * or simplify this.
 */
function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['dist/main.js']  // Make sure the path is correct for your bundle
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error injecting content script:', chrome.runtime.lastError.message);
    } else {
      console.log('Content script injected successfully.');
    }
    if (callback) callback();
  });
}

/**
 * Listen for messages from the content script. 
 * - “contentScriptReady” means the content script is injected and ready.
 * 
 * Because we’re using rrweb, we typically won’t see “interactionData” here—rrweb handles all events internally.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contentScriptReady") {
    console.log("Content script reported ready from tab:", sender.tab?.id);
    sendResponse({ status: "ready" });
    return; // No further processing needed.
  }
  // If you previously handled custom interactionData, you can remove that code now,
  // since rrweb automatically handles event capture in the content script.
});

/**
 * Listen for the keyboard shortcut “Ctrl+Shift+Z” (defined in manifest commands),
 * toggle the “start” or “stop” state, and notify the content script. 
 */
chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-recording") return;

  // Persist the "recording" state in chrome.storage
  chrome.storage.local.get({ recording: false }, (result) => {
    const wasRecording = result.recording;
    const nowRecording = !wasRecording;

    console.log(`Recording ${nowRecording ? "started" : "stopped"}.`);

    // Update storage
    chrome.storage.local.set({ recording: nowRecording }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error updating recording state:", chrome.runtime.lastError.message);
      }
    });

    // Show a desktop notification
    showNotification(
      nowRecording ? "Recording Started" : "Recording Stopped",
      nowRecording
        ? "User interaction recording (rrweb) has started."
        : "rrweb recording has stopped."
    );

    // Find the active tab
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

      // Inject the content script if needed (or skip if declared in manifest).
      injectContentScript(tabId, () => {
        // After injection, send "start" or "stop" message
        chrome.tabs.sendMessage(tabId, { action }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message to content script:", chrome.runtime.lastError.message);
          } else {
            console.log(`Message '${action}' sent. Content script response:`, response);
          }

          // If we're stopping, export the recorded rrweb events
          if (!nowRecording) {
            exportRecording();
          }
        });
      });
    });
  });
});
