console.log("LiteExport content script loaded in top frame?", window.top === window.self);
(function() {
    // Only run in top frame
    if (window.top !== window.self) {
      return;
    }
    
    // -- Ping handler for background verification --
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "ping") {
        sendResponse({ pong: true });
        return; // Exit immediately on ping
      }
      // Existing message handler continues below...
      try {
        if (message.action === "start") {
          initializeTracking();
          sendResponse({ status: "lite tracking started" });
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
    
    // -- The rest of your code remains mostly the same --
    // (Helper functions, event handlers, attachEventListeners, etc.)
    
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
    
    // Instead of storing events locally, send each event to the background.
    function logEvent(type, data) {
      const eventRecord = { type, timestamp: Date.now(), ...data };
      chrome.runtime.sendMessage({ action: "recordLiteEvent", liteEvent: eventRecord });
      if (type !== "mouseMovement") {
        triggerScreenshot(type);
      }
    }
    
    function triggerScreenshot(screenshotType) {
      chrome.runtime.sendMessage({ action: "takeScreenshot", screenshotType: screenshotType });
    }
    
    // Event handlers (click, contextmenu, mousemove, scroll, resize, input, keydown, URL change)
    function handleClick(event) {
      try {
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
    
    function handleContextMenu(event) {
      try {
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
    function handleMouseMove(event) {
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
    function handleScroll() {
      try {
        if (scrollStart === null) {
          scrollStart = { scrollX: window.scrollX, scrollY: window.scrollY };
        }
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          let scrollEnd = { scrollX: window.scrollX, scrollY: window.scrollY };
          logEvent("scrollMovement", { start: scrollStart, end: scrollEnd });
          scrollStart = null;
        }, 250);
      } catch (err) {
        console.error("Error in scroll handler:", err);
      }
    }
    
    let resizeTimeout = null;
    let resizeStart = null;
    function handleResize() {
      try {
        if (resizeStart === null) {
          resizeStart = { width: window.innerWidth, height: window.innerHeight };
        }
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          let resizeEnd = { width: window.innerWidth, height: window.innerHeight };
          logEvent("windowResize", { start: resizeStart, end: resizeEnd });
          resizeStart = null;
        }, 250);
      } catch (err) {
        console.error("Error in resize handler:", err);
      }
    }
    
    function handleInput(event) {
      try {
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
    
    function handleKeydown(event) {
      try {
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
    
    function handleUrlChange() {
      try {
        logEvent("urlChange", { url: window.location.href });
      } catch (err) {
        console.error("Error in URL change handler:", err);
      }
    }
    
    function attachEventListeners() {
      document.addEventListener("click", handleClick, true);
      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", handleResize);
      document.addEventListener("input", handleInput);
      document.addEventListener("keydown", handleKeydown);
      logEvent("urlInit", { url: window.location.href });
      window.addEventListener("popstate", handleUrlChange);
      window.addEventListener("hashchange", handleUrlChange);
    }
    
    function removeEventListeners() {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    }
    
    let trackingInitialized = false;
    function initializeTracking() {
      if (trackingInitialized) return;
      attachEventListeners();
      trackingInitialized = true;
      console.log("LiteExport tracking initialized.");
    }
    
    function destroyTracking() {
      if (!trackingInitialized) return;
      removeEventListeners();
      trackingInitialized = false;
      console.log("LiteExport tracking destroyed.");
    }
    
    console.log("LiteExport module loaded (conditional initialization enabled).");
    
    // Signal that the content script is ready.
    chrome.runtime.sendMessage({ action: "contentScriptReady" });
  })();
  