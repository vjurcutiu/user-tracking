let liteEvents = [];

function getElementSelector(el) {
  if (!el || !el.tagName) return null;
  let selector = el.tagName.toLowerCase();
  if (el.id) selector += `#${el.id}`;
  if (el.classList.length) selector += `.${[...el.classList].join('.')}`;
  return selector;
}

function getElementDetails(el) {
  if (!el || !el.tagName) return {};
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: el.classList ? Array.from(el.classList) : [],
    selector: getElementSelector(el)
  };
}

function logEvent(type, data) {
  // Record the event
  liteEvents.push({ type, timestamp: Date.now(), ...data });
  // Trigger a screenshot unless it's a mouseMovement event
  if (type !== "mouseMovement") {
    triggerScreenshot();
  }
}

function triggerScreenshot() {
  // Send a message to the background script to take a screenshot
  chrome.runtime.sendMessage({ action: "takeScreenshot" });
}

// ===================== URL TRACKER =====================
// Record the current URL at initialization.
let currentUrl = window.location.href;
logEvent("urlInit", { url: currentUrl });

// Function to record URL changes.
function recordURLChange(oldUrl, newUrl) {
  logEvent("urlChange", { oldUrl, newUrl });
  currentUrl = newUrl;
}
window.addEventListener("popstate", () => {
  recordURLChange(currentUrl, window.location.href);
});
window.addEventListener("hashchange", () => {
  recordURLChange(currentUrl, window.location.href);
});

// ===================== CLICK TRACKER =====================
document.addEventListener("click", (event) => {
  const data = {
    element: getElementDetails(event.target),
    text: event.target.innerText ? event.target.innerText.slice(0, 50) : null,
    position: { x: event.clientX, y: event.clientY }
  };
  console.log('Click event data:', data);
  logEvent("click", data);
});

// ===================== RIGHT-CLICK TRACKER =====================
document.addEventListener("contextmenu", (event) => {
  const data = {
    element: getElementDetails(event.target),
    position: { x: event.clientX, y: event.clientY }
  };
  logEvent("rightClick", data);
});

// ===================== MOUSE DRAG TRACKER =====================
let mouseDownPosition = null;
document.addEventListener("mousedown", (event) => {
  mouseDownPosition = { x: event.clientX, y: event.clientY };
});
document.addEventListener("mouseup", (event) => {
  if (mouseDownPosition) {
    logEvent("mouseDrag", {
      start: mouseDownPosition,
      end: { x: event.clientX, y: event.clientY }
    });
    mouseDownPosition = null;
  }
});

// ===================== MOUSE MOVEMENT TRACKER =====================
let mouseMoveStart = null;
let mouseMoveTimeout = null;
document.addEventListener("mousemove", (event) => {
  if (mouseMoveStart === null) {
    mouseMoveStart = { x: event.clientX, y: event.clientY };
  }
  if (mouseMoveTimeout) clearTimeout(mouseMoveTimeout);
  mouseMoveTimeout = setTimeout(() => {
    const mouseMoveEnd = { x: event.clientX, y: event.clientY };
    logEvent("mouseMovement", { start: mouseMoveStart, end: mouseMoveEnd });
    mouseMoveStart = null;
    mouseMoveTimeout = null;
  }, 250); // Adjust delay as needed
});

// ===================== SCROLL TRACKER =====================
let scrollTimeout = null;
let scrollStart = null;
window.addEventListener("scroll", () => {
  if (scrollStart === null) {
    scrollStart = { scrollX: window.scrollX, scrollY: window.scrollY };
  }
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    let scrollEnd = { scrollX: window.scrollX, scrollY: window.scrollY };
    logEvent("scrollMovement", { start: scrollStart, end: scrollEnd });
    scrollStart = null;
  }, 250); // Adjust delay as needed
});

// ===================== WINDOW RESIZE TRACKER =====================
let resizeTimeout = null;
let resizeStart = null;
window.addEventListener("resize", () => {
  if (resizeStart === null) {
    resizeStart = { width: window.innerWidth, height: window.innerHeight };
  }
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    let resizeEnd = { width: window.innerWidth, height: window.innerHeight };
    logEvent("windowResize", { start: resizeStart, end: resizeEnd });
    resizeStart = null;
  }, 250); // Adjust delay as needed
});

// ===================== INPUT TRACKER =====================
document.addEventListener("input", (event) => {
  const target = event.target;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    logEvent("input", {
      element: getElementDetails(target),
      value: target.type === "password" ? "****" : target.value.slice(0, 100)
    });
  }
});

// ===================== KEYPRESS TRACKER =====================
document.addEventListener("keydown", (event) => {
  logEvent("keypress", {
    key: event.key,
    keyCode: event.keyCode,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey
  });
});

// ===================== MESSAGE HANDLER =====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "exportLite") {
    try {
      console.log("Received exportLite message", message);
      console.log("Exporting lite events:", liteEvents);
      sendResponse({ liteEvents });
    } catch (err) {
      console.error('Error sending liteEvents:', err);
      sendResponse({ error: err.message });
    }
  } else if (message.action === "clearLiteEvents") {
    liteEvents = [];
  }
});

console.log("LiteExport module loaded.");
