import pako from 'pako';
import JSZip from 'jszip';
import { blobToDataUrl, downloadDataUrl, exportGenericData } from './src/utils.js';

let recordingTabId = null; 
let recording = false;

let allEvents = []; // rrweb events
let liteEventsGlobal = []; // Global lite events
let interactableElementsGlobal = [];
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
  console.log('Exporting rrweb events:', allEvents);
  exportGenericData({
    exportType: 'rrweb',
    events: allEvents,
    filenamePrefix: 'rrweb-recording-',
    compress: true // Gzip for rrweb
  });
}

function exportLiteRecording() {
  console.log("Exporting lite events:", liteEventsGlobal);
  exportGenericData({
    exportType: 'lite',
    events: liteEventsGlobal,
    filenamePrefix: 'lite-recording-',
    compress: false // Usually no compression for small data
  });

  // Optionally clear liteEvents after export
  liteEventsGlobal = [];
}

function exportInteractableElements() {
  console.log("Exporting interactable elements:", interactableElementsGlobal);
  exportGenericData({
    exportType: 'interactableElements',
    events: interactableElementsGlobal,
    filenamePrefix: 'interactable-elements-',
    compress: false  // Usually not necessary to gzip small data
  });

  // If you prefer to clear them after export:
  interactableElementsGlobal = [];
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
    } else if (message.action === "recordInteractableElements") {
      if (Array.isArray(message.elements)) {
        interactableElementsGlobal = message.elements;
        console.log("Interactable elements stored:", interactableElementsGlobal);
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
            exportLiteRecording();
            exportInteractableElements();
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
