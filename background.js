import pako from 'pako';
import JSZip from 'jszip';
import { blobToDataUrl, downloadDataUrl } from './src/downloadHelper.js';

let recordingTabId = null; 
let recording = false;


let allEvents = [];

function showNotification(title, message) {
  const iconUrl = chrome.runtime.getURL('icon.png'); // use an absolute URL
  chrome.notifications.create('notification-' + Date.now(), {
    type: 'basic',
    iconUrl: iconUrl,
    title: title,
    message: message
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("Notification error:", chrome.runtime.lastError.message);
    } else {
      console.log("Notification created with id:", notificationId);
    }
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
      saveAs: false,
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
          saveAs: false,
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

// Make sure JSZip is included in your extension (e.g., as a local file in your manifest)
let screenshotQueue = [];
let screenshotCounter = 0;

// Listener for screenshot messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "takeScreenshot") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("Screenshot capture failed:", chrome.runtime.lastError.message);
        return;
      }
      screenshotCounter++;
      const timestamp = Date.now();
      // Get the screenshot type from the message, defaulting to "unknown" if not provided.
      const screenshotType = message.screenshotType || "unknown";
      const filename = `${screenshotCounter}.SS-${timestamp}-${screenshotType}.png`;
      // Store both the filename and the dataUrl
      screenshotQueue.push({ filename, dataUrl });
      console.log("Screenshot queued:", filename);
    });
  }
});

// Call this function when the recording session ends
function archiveScreenshots() {
  const zip = new JSZip();
  screenshotQueue.forEach(item => {
    // Remove the "data:image/png;base64," prefix so that JSZip can interpret the remaining data as base64
    const base64Data = item.dataUrl.split(',')[1];
    zip.file(item.filename, base64Data, { base64: true });
  });
  
  zip.generateAsync({ type: "blob" })
    .then((blob) => {
      return blobToDataUrl(blob);
    })
    .then((dataUrl) => {
      chrome.downloads.download({
        url: dataUrl,
        filename: "screenshots.zip",
        saveAs: true, // Set to false if you want to bypass the prompt
        conflictAction: 'uniquify'
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Download failed:", chrome.runtime.lastError.message);
        } else {
          console.log("Archive downloaded successfully.");
        }
        // Optionally clear the queue after download
        screenshotQueue = [];
        screenshotCounter = 0;
      });
    })
    .catch((err) => {
      console.error("Error creating archive:", err);
    });
}

function ensureContentScript(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      // No response means the content script isn't present, so inject it.
      console.log(`Content script not found in tab ${tabId}, injecting...`);
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['dist/main.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error injecting content script:', chrome.runtime.lastError.message);
        }
        // Give it a moment to load, then call the callback.
        setTimeout(callback, 500);
      });
    } else {
      // Content script is already present.
      callback();
    }
  });
}

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

      if (nowRecording) {
        // Ensure content script is present then send "start" message.
        ensureContentScript(tabId, () => {
          chrome.tabs.sendMessage(tabId, { action: 'start' }, (resp) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending start to content script:', chrome.runtime.lastError.message);
            } else {
              console.log(`Recording started on tab ${tabId}`);
            }
          });
        });
      } else {
        // Ensure content script is present then send "stop" message.
        ensureContentScript(tabId, () => {
          chrome.tabs.sendMessage(tabId, { action: 'stop' }, (resp) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending stop to content script:', chrome.runtime.lastError.message);
            } else {
              console.log(`Recording stopped on tab ${tabId}`);
            }
            exportRecording();
            exportLiteRecording(tabId);
            archiveScreenshots();
          });
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
