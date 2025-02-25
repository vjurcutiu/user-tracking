// eventHandlers.js
import { getElementDetails } from './domUtils.js';

let userInteracted = false;
export function markUserInteraction() {
  userInteracted = true;
  // Reset the flag after a short period to prevent capturing later mutations mistakenly.
  setTimeout(() => { userInteracted = false; }, 500);
}

export function logEvent(type, data) {
  const eventRecord = { type, timestamp: Date.now(), ...data };
  chrome.runtime.sendMessage({ action: "recordLiteEvent", liteEvent: eventRecord });
  // Trigger screenshot for specific event types
  if (type === "pageLoad" || type === "scrollMovement" || type === "domMutation") {
    triggerScreenshot(type);
  }
}

export function triggerScreenshot(screenshotType) {
  chrome.runtime.sendMessage({ action: "takeScreenshot", screenshotType });
}

export function handleClick(event) {
  try {
    markUserInteraction();
    const data = {
      element: getElementDetails(event.target),
      text: event.target.innerText ? event.target.innerText.slice(0, 50) : null,
      position: { x: event.clientX, y: event.clientY }
    };
    console.log("Click event fired", data);
    logEvent("click", data);
  } catch (err) {
    console.error("Error in click handler:", err);
  }
}

export function handleContextMenu(event) {
  try {
    markUserInteraction();
    const data = {
      element: getElementDetails(event.target),
      position: { x: event.clientX, y: event.clientY }
    };
    logEvent("rightClick", data);
  } catch (err) {
    console.error("Error in contextmenu handler:", err);
  }
}

let mouseMoveStart = null;
let mouseMoveTimeout = null;
export function handleMouseMove(event) {
  try {
    if (mouseMoveStart === null) {
      mouseMoveStart = { x: event.clientX, y: event.clientY };
    }
    if (mouseMoveTimeout) clearTimeout(mouseMoveTimeout);
    mouseMoveTimeout = setTimeout(() => {
      const mouseMoveEnd = { x: event.clientX, y: event.clientY };
      logEvent("mouseMovement", { start: mouseMoveStart, end: mouseMoveEnd });
      mouseMoveStart = null;
      mouseMoveTimeout = null;
    }, 250);
  } catch (err) {
    console.error("Error in mousemove handler:", err);
  }
}

let scrollTimeout = null;
let scrollStart = null;
export function handleScroll() {
  try {
    if (scrollStart === null) {
      scrollStart = { scrollX: window.scrollX, scrollY: window.scrollY };
    }
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollEnd = { scrollX: window.scrollX, scrollY: window.scrollY };
      logEvent("scrollMovement", { start: scrollStart, end: scrollEnd });
      scrollStart = null;
    }, 250);
  } catch (err) {
    console.error("Error in scroll handler:", err);
  }
}

let resizeTimeout = null;
let resizeStart = null;
export function handleResize() {
  try {
    if (resizeStart === null) {
      resizeStart = { width: window.innerWidth, height: window.innerHeight };
    }
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const resizeEnd = { width: window.innerWidth, height: window.innerHeight };
      logEvent("windowResize", { start: resizeStart, end: resizeEnd });
      resizeStart = null;
    }, 250);
  } catch (err) {
    console.error("Error in resize handler:", err);
  }
}

export function handleInput(event) {
  try {
    markUserInteraction();
    const target = event.target;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      logEvent("input", {
        element: getElementDetails(target),
        value: target.type === "password" ? "****" : target.value.slice(0, 100)
      });
    }
  } catch (err) {
    console.error("Error in input handler:", err);
  }
}

export function handleKeydown(event) {
  try {
    markUserInteraction();
    logEvent("keypress", {
      key: event.key,
      keyCode: event.keyCode,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey
    });
  } catch (err) {
    console.error("Error in keydown handler:", err);
  }
}

export function handleUrlChange() {
  try {
    logEvent("urlChange", { url: window.location.href });
  } catch (err) {
    console.error("Error in URL change handler:", err);
  }
}

export function handleFormSubmit(event) {
  try {
    markUserInteraction();
    const data = {
      element: getElementDetails(event.target)
    };
    console.log("Form submit event fired", data);
    logEvent("formSubmit", data);
    triggerScreenshot("formSubmit");
  } catch (err) {
    console.error("Error in form submit handler:", err);
  }
}
