(function() {
    if (window.top !== window.self) {
        // We’re in an iframe, so do nothing.
        return;
      }
    // We'll track whether our event listeners are attached
    let trackingInitialized = false;
    let liteEvents = [];
  
    // -- Helper Functions --
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
      liteEvents.push({ type, timestamp: Date.now(), ...data });
      // Trigger a screenshot for most events (if desired)
      if (type !== "mouseMovement") {
        triggerScreenshot(type);
      }
    }
    
    /**
     * Sends a message to the background script to take a screenshot.
     * @param {string} screenshotType - A string describing the event (e.g., "click", "scroll").
     */
    function triggerScreenshot(screenshotType) {
      chrome.runtime.sendMessage({ action: "takeScreenshot", screenshotType: screenshotType });
    }
  
    // -- Event Handlers --
    function handleClick(event) {
        try {
          console.log("Click event fired", {
            target: event.target,
            frame: window.top === window.self
          });
          const data = {
            element: getElementDetails(event.target),
            text: event.target.innerText ? event.target.innerText.slice(0, 50) : null,
            position: { x: event.clientX, y: event.clientY }
          };
          logEvent("click", data);
        } catch (err) {
          console.error("Error handling click event:", err);
        }
      }
    
    function handleContextMenu(event) {
      const data = {
        element: getElementDetails(event.target),
        position: { x: event.clientX, y: event.clientY }
      };
      logEvent("rightClick", data);
    }
        
    let mouseMoveStart = null;
    let mouseMoveTimeout = null;
    function handleMouseMove(event) {
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
    }
    
    let scrollTimeout = null;
    let scrollStart = null;
    function handleScroll() {
      if (scrollStart === null) {
        scrollStart = { scrollX: window.scrollX, scrollY: window.scrollY };
      }
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        let scrollEnd = { scrollX: window.scrollX, scrollY: window.scrollY };
        logEvent("scrollMovement", { start: scrollStart, end: scrollEnd });
        scrollStart = null;
      }, 250);
    }
    
    let resizeTimeout = null;
    let resizeStart = null;
    function handleResize() {
      if (resizeStart === null) {
        resizeStart = { width: window.innerWidth, height: window.innerHeight };
      }
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        let resizeEnd = { width: window.innerWidth, height: window.innerHeight };
        logEvent("windowResize", { start: resizeStart, end: resizeEnd });
        resizeStart = null;
      }, 250);
    }
    
    function handleInput(event) {
      const target = event.target;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        logEvent("input", {
          element: getElementDetails(target),
          value: target.type === "password" ? "****" : target.value.slice(0, 100)
        });
      }
    }
    
    function handleKeydown(event) {
      logEvent("keypress", {
        key: event.key,
        keyCode: event.keyCode,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey
      });
    }
    
    // -- Attach/Remove Listeners --
    function attachEventListeners() {
      document.addEventListener("click", handleClick, true);
      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", handleResize);
      document.addEventListener("input", handleInput);
      document.addEventListener("keydown", handleKeydown);
      // Record initial URL
      logEvent("urlInit", { url: window.location.href });
      window.addEventListener("popstate", handleUrlChange);
      window.addEventListener("hashchange", handleUrlChange);
    }
    
    function handleUrlChange() {
      logEvent("urlChange", { url: window.location.href });
    }
    
    function removeEventListeners() {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    }
    
    // -- Public Methods --
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
    
    // -- Message Handler --
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "ping") {
          sendResponse({ pong: true });
          return; // Stop processing further actions for the ping.
        }
        // Existing message handler code follows...
        if (message.action === "start") {
          initializeTracking();
          sendResponse({ status: "lite tracking started" });
        } else if (message.action === "stop") {
          destroyTracking();
          sendResponse({ status: "lite tracking stopped" });
        } else if (message.action === "exportLite") {
          sendResponse({ liteEvents });
        } else if (message.action === "clearLiteEvents") {
          liteEvents = [];
        }
      });
    
    console.log("LiteExport module loaded (conditional initialization enabled).");
  })();
  