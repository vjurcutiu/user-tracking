// communication.js
export function setupCommunication({ initializeTracking, captureInteractableElements, destroyTracking }) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "ping") {
        sendResponse({ pong: true });
        return; // Exit immediately on ping
      }
      try {
        if (message.action === "start") {
          initializeTracking();
          captureInteractableElements();
          sendResponse({ status: "lite tracking + element capture started" });
        } else if (message.action === "stop") {
          destroyTracking();
          sendResponse({ status: "lite tracking stopped" });
        } else if (message.action === "exportLite") {
          sendResponse({ status: "export not handled here" });
        } else if (message.action === "clearLiteEvents") {
          // Not used in this new pattern.
        }
      } catch (err) {
        console.error("Error in message handler:", err);
        sendResponse({ error: err.message });
      }
    });
  }
  