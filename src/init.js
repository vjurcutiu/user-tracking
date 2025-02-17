// content.js (rrweb version)

import { record } from 'rrweb'; 
// Make sure rrweb is installed and bundled, or included as a script if not using a bundler.

let currentUrl = window.location.href;
let isRecording = false;
let stopRecording = null; // Function returned by rrweb to stop recording
let rrwebEvents = [];

// Optional: monitor URL changes, if you still want to log them separately
function monitorUrlChanges() {
  const observer = new MutationObserver(() => {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      console.log(`URL changed: ${currentUrl} -> ${newUrl}`);
      currentUrl = newUrl;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Called once the script loads or DOM is ready
function initialize() {
  console.log('Initializing rrweb content script...');
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Extension context is unavailable. Aborting initialization.');
    return;
  }

  // If you want to watch URL changes at all times (recording or not), keep this
  monitorUrlChanges();

  // Notify background that the content script is loaded/ready.
  chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending readiness message:', chrome.runtime.lastError.message);
    } else {
      console.log('Content script is ready. Background response:', response);
    }
  });
}

// Start rrweb recording
function startRrwebRecording() {
  if (isRecording) {
    console.log('rrweb is already recording.'); 
    return;
  }
  isRecording = true;

  // Clear any old events
  rrwebEvents = [];

  // Begin capturing
  stopRecording = record({
    emit(event) {
      rrwebEvents.push(event);
    },
    // Optionally configure rrweb (e.g., to record canvas, checkoutEveryNms, etc.)
    // recordCanvas: true,
    // checkoutEveryNms: 10_000,
  });

  console.log('rrweb recording started.');
}

// Stop rrweb recording
function stopRrwebRecording() {
  if (!isRecording || !stopRecording) {
    console.log('rrweb is not currently recording.');
    return;
  }
  isRecording = false;

  // Stop capturing
  stopRecording();
  stopRecording = null;

  console.log(`rrweb recording stopped. Captured ${rrwebEvents.length} events.`);

  // If you like, store the events so the background can export them
  chrome.storage.local.set({ rrwebEvents }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving rrweb events:', chrome.runtime.lastError.message);
    } else {
      console.log('rrweb events saved to local storage.');
    }
  });
}

// Listen for "start"/"stop" from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    console.log('Received "start" in rrweb content script.');
    startRrwebRecording();
    sendResponse({ status: 'started' });
  } else if (message.action === 'stop') {
    console.log('Received "stop" in rrweb content script.');
    stopRrwebRecording();
    sendResponse({ status: 'stopped' });
  }

  // If you need to respond asynchronously, you could do: return true;
});

console.log('rrweb content script loaded on:', window.location.href);

// Initialize once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
