import pako from 'pako';
import JSZip from 'jszip';
import { blobToDataUrl, downloadDataUrl } from './src/downloadHelper.js';

let recordingTabId = null; 
let recording = false;

let allEvents = []; // rrweb events
let liteEventsGlobal = []; // Global lite events
let screenshotQueue = [];
let screenshotCounter = 0;

function showNotification(title, message) {
  const iconUrl = chrome.runtime.getURL('icon.png');
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
  // (rrweb export code unchanged)
  console.log('Exporting rrweb events:', allEvents);
  let json;
  try {
    json = JSON.stringify(allEvents, null, 2);
  } catch (err) {
    console.error('Failed to stringify rrweb events:', err);
    return;
  }
  try {
    const compressed = pako.gzip(json);
    let binaryString = '';
    for (let i = 0; i < compressed.length; i++) {
      binaryString += String.fromCharCode(compressed[i]);
    }
    const base64 = btoa(binaryString);
    const dataUrl = `data:application/octet-stream;base64,${base64}`;
    chrome.downloads.download({
      url: dataUrl,
      filename: `rrweb-recording-${Date.now()}.json.gz`,
      saveAs: false,
      conflictAction: 'uniquify'
    }, () => {
      // Do not clear allEvents to preserve data if desired.
      console.log("rrweb export complete.");
    });
  } catch (compressionError) {
    console.error('Compression failed:', compressionError);
  }
}

function exportLiteRecording(tabId) {  
  console.log("Exporting lite events:", liteEventsGlobal);
  let json;
  try {
    json = JSON.stringify(liteEventsGlobal, null, 2);
  } catch (err) {
    console.error('Failed to stringify lite events:', err);
    return;
  }
  try {      
    const base64 = btoa(json);
    const dataUrl = `data:application/octet-stream;base64,${base64}`;

    chrome.downloads.download({
      url: dataUrl,
      saveAs: false,
      filename: `lite-recording-${Date.now()}.json`,
      conflictAction: 'uniquify'
    }, () => {
      console.log("Lite events export complete.");
      // Clear the global lite events so each session starts fresh.
      liteEventsGlobal = [];
    });
  } catch (liteExportError) {
    console.error('Export of lite events failed:', liteExportError);
  }
}

function archiveScreenshots() {
  try {
    const zip = new JSZip();
    screenshotQueue.forEach(item => {
      const base64Data = item.dataUrl.split(',')[1];
      zip.file(item.filename, base64Data, { base64: true });
    });
    zip.generateAsync({ type: "blob" })
      .then((blob) => blobToDataUrl(blob))
      .then((dataUrl) => {
        chrome.downloads.download({
          url: dataUrl,
          filename: "screenshots.zip",
          saveAs: true,
          conflictAction: 'uniquify'
        }, () => {
          console.log("Screenshot archive downloaded successfully.");
          // Clear the screenshot queue and reset counter after export
          screenshotQueue = [];
          screenshotCounter = 0;
        });
      })
      .catch((err) => {
        console.error("Error creating archive:", err);
      });
  } catch (err) {
    console.error("Error in archiveScreenshots:", err);
  }
}


// Helper to ensure content script is ready (ping with retries)
function ensureContentScript(tabId, callback, retries = 3) {
  chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      if (retries > 0) {
        setTimeout(() => {
          ensureContentScript(tabId, callback, retries - 1);
        }, 500);
      } else {
        console.error("Content script did not respond to ping in tab", tabId);
      }
    } else {
      callback();
    }
  });
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'contentScriptReady') {
      console.log(`Content script ready on tab ${sender.tab?.id}`);
      sendResponse({ status: 'ready' });
    } else if (message.rrwebEvent) {
      allEvents.push(message.rrwebEvent);
    } else if (message.action === "recordLiteEvent") {
      if (message.liteEvent) {
        liteEventsGlobal.push(message.liteEvent);
      }
    } else if (message.action === "takeScreenshot") {
      chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
        try {
          if (chrome.runtime.lastError) {
            console.error("Screenshot capture failed:", chrome.runtime.lastError.message);
            return;
          }
          screenshotCounter++;
          const timestamp = Date.now();
          const screenshotType = message.screenshotType || "unknown";
          const filename = `${screenshotCounter}.SS-${timestamp}-${screenshotType}.png`;
          screenshotQueue.push({ filename, dataUrl });
          console.log("Screenshot queued:", filename);
        } catch (innerErr) {
          console.error("Error in screenshot callback:", innerErr);
        }
      });
    }
  } catch (err) {
    console.error("Error in background message handler:", err);
  }
});

// Remove dynamic injection since manifest auto-injects content scripts.
  
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
      nowRecording ? 'Recording for this tab has started.' : 'Recording stopped.'
    );
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || !tabs[0].id) return;
      const tabId = tabs[0].id;
      recordingTabId = nowRecording ? tabId : null;
      if (nowRecording) {
        // Ensure the content script is present before sending start.
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
      console.log(`Tab ${tabId} loaded a new page. Ensuring content script is active.`);
      ensureContentScript(tabId, () => {
        chrome.tabs.sendMessage(tabId, { action: 'start' }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending start on new page:', chrome.runtime.lastError.message);
          } else {
            console.log('Recording resumed on new page in tab', tabId);
          }
        });
      });
    }
  });
});
