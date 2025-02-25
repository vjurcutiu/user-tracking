// main.js
import { setupCommunication } from './communication.js';
import { captureInteractableElements } from './domUtils.js';
import { initializeTracking, destroyTracking } from './eventManagement.js';
import { waitForStableDOM } from './observers.js';
import { logEvent } from './eventHandlers.js';
(function() {
    // Only run in top frame.
    if (window.top !== window.self) {
    return;
    }

    setupCommunication({
    initializeTracking,
    captureInteractableElements,
    destroyTracking
    });

    // Wait for the DOM to be stable and then log the page load event.
    window.addEventListener("load", () => {
    waitForStableDOM(() => {
        logEvent("pageLoad", { url: window.location.href });
    });
    });

    console.log("LiteExport module loaded (conditional initialization enabled).");
    chrome.runtime.sendMessage({ action: "contentScriptReady" });
})();