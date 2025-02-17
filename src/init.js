// content.js (modified)

import { debounce, throttle } from './utils.js';
import {
  handleUserInteraction,
  handleMouseMove,
  handleContextMenu,
  handleResize,
  handleFormSubmission
} from './listeners.js';
import {
  captureInitialDomSnapshot,
  startObservingDom,
  stopObservingDom,
  getDomMutations
} from './domSnapshot.js';

let currentUrl = window.location.href;

// Store references for debounced/throttled functions so we can remove them later.
let debouncedHandleInput;
let debouncedHandleScroll;
let throttledHandleMouseMove;
let debouncedHandleResize;

// Track whether we’re actively recording.
let isRecording = false;

console.log("Content script loaded on:", window.location.href);

// Monitor URL changes if you still want to track them in general
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

export function attachListeners() {
  // Only attach if we’re not already recording
  if (isRecording) return;
  isRecording = true;

  debouncedHandleInput = debounce(handleUserInteraction, 300);
  debouncedHandleScroll = debounce(handleUserInteraction, 500);
  throttledHandleMouseMove = throttle(handleMouseMove, 200);
  debouncedHandleResize = debounce(handleResize, 300);

  document.addEventListener('click', handleUserInteraction);
  document.addEventListener('input', debouncedHandleInput);
  document.addEventListener('scroll', debouncedHandleScroll);
  document.addEventListener('keydown', handleUserInteraction);
  document.addEventListener('mousemove', throttledHandleMouseMove);
  document.addEventListener('contextmenu', handleContextMenu);
  window.addEventListener('resize', debouncedHandleResize);
  document.addEventListener('submit', handleFormSubmission, true);

  console.log('Event listeners attached.');
}

export function detachListeners() {
  if (!isRecording) return;
  isRecording = false;

  document.removeEventListener('click', handleUserInteraction);
  document.removeEventListener('input', debouncedHandleInput);
  document.removeEventListener('scroll', debouncedHandleScroll);
  document.removeEventListener('keydown', handleUserInteraction);
  document.removeEventListener('mousemove', throttledHandleMouseMove);
  document.removeEventListener('contextmenu', handleContextMenu);
  window.removeEventListener('resize', debouncedHandleResize);
  document.removeEventListener('submit', handleFormSubmission, true);

  console.log('Event listeners detached.');
}

// Minimal initialization: we do NOT attach listeners or observe DOM here.
// Instead, we wait for a "start" message from background.js
function initialize() {
  console.log('Initializing content script...');
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Extension context is unavailable. Aborting initialization.');
    return;
  }

  // If you want to watch URL changes even when not recording, keep monitorUrlChanges():
  monitorUrlChanges();

  // Notify background that the content script is loaded/ready.
  chrome.runtime.sendMessage({ action: "contentScriptReady" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending readiness message:", chrome.runtime.lastError.message);
    } else {
      console.log("Content script is ready. Background response:", response);
    }
  });
}

// Run `initialize()` once the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Listen for "start"/"stop" from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start") {
    console.log("Recording started (content script).");

    // 1. Capture the DOM snapshot
    const initialDomSnapshot = captureInitialDomSnapshot();
    console.log('Initial DOM Snapshot captured.');
    chrome.storage.local.set({ initialDomSnapshot }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error storing initial DOM snapshot:", chrome.runtime.lastError.message);
      }
    });

    // 2. Start observing DOM mutations
    startObservingDom();

    // 3. Attach listeners
    attachListeners();

    sendResponse({ status: "started" });
  } else if (message.action === "stop") {
    console.log("Recording stopped (content script).");

    // 1. Detach event listeners
    detachListeners();

    // 2. Stop observing DOM
    stopObservingDom();

    // 3. Log what was recorded
    console.log('Recorded DOM Mutations:', getDomMutations());

    sendResponse({ status: "stopped" });
  }

  // If you need to respond asynchronously, return true here
  // return true;
});

console.log("Content script message listener registered.");
