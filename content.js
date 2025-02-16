// utils.js
 function buildInteractionData(event) {
  const interactionData = {
    type: event.type,
    target: event.target.tagName,
    id: event.target.id || null,
    classes: event.target.className || null,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };
  if (event.type === 'click') {
    interactionData.mouseCoordinates = {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    };
  }
  return interactionData;
}

 function safeSendMessage(message) {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('Extension context is unavailable. Cannot send message.');
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to send message:', chrome.runtime.lastError.message);
      } else if (response?.status !== 'success') {
        console.warn('Unexpected response:', response);
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

 function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

 function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}


// Handles generic user interactions (e.g., clicks, inputs, keydowns)
 function handleUserInteraction(event) {
  const interactionData = buildInteractionData(event);
  safeSendMessage({ interactionData });
}

// Handles mouse movement with throttling applied in init.js
 function handleMouseMove(event) {
  const mouseData = {
    type: 'mousemove',
    timestamp: new Date().toISOString(),
    coordinates: {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    },
    url: window.location.href,
  };
  safeSendMessage({ interactionData: mouseData });
}

// Handles context menu (right-click) events
 function handleContextMenu(event) {
  const interactionData = {
    type: 'contextmenu',
    target: event.target.tagName,
    id: event.target.id || null,
    classes: event.target.className || null,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    mouseCoordinates: {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    },
  };
  safeSendMessage({ interactionData });
}

/* New Handlers */

// Handle window resize events
 function handleResize(event) {
  const interactionData = {
    type: 'resize',
    timestamp: new Date().toISOString(),
    windowSize: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    url: window.location.href,
  };
  safeSendMessage({ interactionData });
}

// Handle form submission events (e.g., contact forms)
 function handleFormSubmission(event) {
  // Optionally, prevent the default form submission if you need to capture data first
  // event.preventDefault();
  
  const form = event.target;
  const interactionData = {
    type: 'formSubmission',
    timestamp: new Date().toISOString(),
    formId: form.id || null,
    formAction: form.action || null,
    url: window.location.href,
  };
  safeSendMessage({ interactionData });
}

// src/domSnapshot.js

// Store recorded mutations in an array.
let domMutations = [];

// Reference to the MutationObserver instance.
let observer = null;

/**
 * Captures a snapshot of the entire DOM at the moment this function is called.
 * @returns {string} The outer HTML of the document element.
 */
 function captureInitialDomSnapshot() {
  return document.documentElement.outerHTML;
}

/**
 * Callback function for the MutationObserver.
 * @param {MutationRecord[]} mutationList - Array of mutations.
 */
function mutationCallback(mutationList) {
  mutationList.forEach((mutation) => {
    // Record a summary of each mutation
    domMutations.push({
      type: mutation.type,
      target: mutation.target.nodeName,
      addedNodes: mutation.addedNodes.length,
      removedNodes: mutation.removedNodes.length,
      attributeName: mutation.attributeName,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Starts observing DOM changes using a MutationObserver.
 * Resets any previously recorded mutations.
 */
 function startObservingDom() {
  // Clear previous mutation records.
  domMutations = [];

  // Create a new MutationObserver instance if not already created.
  if (!observer) {
    observer = new MutationObserver(mutationCallback);
  }

  // Configure observer options: monitor child list changes, subtree changes, and attribute changes.
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
  });

  console.log('DOM MutationObserver started.');
}

/**
 * Stops observing DOM changes.
 */
 function stopObservingDom() {
  if (observer) {
    observer.disconnect();
    console.log('DOM MutationObserver stopped.');
  }
}

/**
 * Returns the array of recorded DOM mutations.
 * @returns {Array} Array of mutation records.
 */
 function getDomMutations() {
  return domMutations;
}

let currentUrl = window.location.href;
let initialDomSnapshot = null;

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

console.log("Content script loaded.");
console.log("Content script (init.js) is loaded on:", window.location.href);


 function attachListeners() {
  document.addEventListener('click', handleUserInteraction);
  document.addEventListener('input', debounce(handleUserInteraction, 300));
  document.addEventListener('scroll', debounce(handleUserInteraction, 500));
  document.addEventListener('keydown', handleUserInteraction);
  document.addEventListener('mousemove', throttle(handleMouseMove, 200));
  document.addEventListener('contextmenu', handleContextMenu);
  
  window.addEventListener('resize', debounce(handleResize, 300));
  document.addEventListener('submit', handleFormSubmission, true);
}

 function detachListeners() {
  document.removeEventListener('click', handleUserInteraction);
  document.removeEventListener('input', handleUserInteraction);
  document.removeEventListener('scroll', handleUserInteraction);
  document.removeEventListener('keydown', handleUserInteraction);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('contextmenu', handleContextMenu);
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('submit', handleFormSubmission, true);
}

function initialize() {
  console.log('Initializing content script...');
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Extension context is unavailable. Aborting initialization.');
    return;
  }
  
  currentUrl = window.location.href;
  
  // Capture the initial DOM snapshot at the start of the recording.
  initialDomSnapshot = captureInitialDomSnapshot();
  chrome.storage.local.set({ initialDomSnapshot: initialDomSnapshot }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error storing initial DOM snapshot:", chrome.runtime.lastError.message);
    } else {
      console.log('Initial DOM Snapshot stored.');
    }
  });
  console.log('Initial DOM Snapshot captured.');

  // Start observing DOM changes.
  startObservingDom();

  attachListeners();
  monitorUrlChanges();

  // Send a "ready" message to the background script to indicate the content script is loaded.
  chrome.runtime.sendMessage({ action: "contentScriptReady" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending readiness message:", chrome.runtime.lastError.message);
    } else {
      console.log("Content script is ready. Background response:", response);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "start") {
    console.log("Recording started.");
    initialDomSnapshot = captureInitialDomSnapshot();
    console.log('Initial DOM Snapshot captured.');
    startObservingDom();
    attachListeners();
  } else if (message.action === "stop") {
    console.log("Recording stopped.");
    detachListeners();
    stopObservingDom();
    console.log('Recorded DOM Mutations:', getDomMutations());
  }
});

console.log("Content script message listener registered.");