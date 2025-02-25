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
  
  // Capture interactable elements on the page
  function captureInteractableElements() {
    const selector = [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]'
    ].join(',');
    
    const elements = Array.from(document.querySelectorAll(selector));
    
    const interactableData = elements.map(el => {
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: el.classList ? Array.from(el.classList) : [],
        xpath: getXPath(el)
      };
    });
    
    chrome.runtime.sendMessage({
      action: 'recordInteractableElements',
      elements: interactableData
    }, (resp) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to send interactable elements:', chrome.runtime.lastError.message);
      }
    });
  }
  
  // Minimal utility to calculate an absolute XPath for a given DOM node
  function getXPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    return getElementTreeXPath(element);
  }
  
  function getElementTreeXPath(element) {
    const paths = [];
    for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
      let index = 0;
      let hasSameTagSiblings = false;
      const siblings = element.parentNode ? element.parentNode.children : [];
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling.tagName === element.tagName) {
          if (sibling === element) {
            index++;
            break;
          }
          index++;
          hasSameTagSiblings = true;
        }
      }
      const tagName = element.tagName.toLowerCase();
      const path = hasSameTagSiblings ? `${tagName}[${index}]` : tagName;
      paths.splice(0, 0, path);
    }
    return paths.length ? '/' + paths.join('/') : null;
  }
  
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
  
  // Log an event and trigger screenshots only on specific events.
  function logEvent(type, data) {
    const eventRecord = { type, timestamp: Date.now(), ...data };
    chrome.runtime.sendMessage({ action: "recordLiteEvent", liteEvent: eventRecord });
    
    // Only trigger screenshots for the following event types:
    if (type === "pageLoad") {
      triggerScreenshot(type);
    } else if (type === "scrollMovement") {
      triggerScreenshot(type);
    } else if (type === "domMutation") {
      triggerScreenshot(type);
    }
  }
  
  function triggerScreenshot(screenshotType) {
    chrome.runtime.sendMessage({ action: "takeScreenshot", screenshotType: screenshotType });
  }
  
  function handleClick(event) {
    markUserInteraction
    try {
      markUserInteraction
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
    markUserInteraction
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
    markUserInteraction
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
    markUserInteraction
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

  function handleFormSubmit(event) {
    markUserInteraction();
    try {
      const data = {
        element: getElementDetails(event.target)
        // Optionally, you could capture additional form data here if needed.
      };
      console.log("Form submit event fired", data);
      logEvent("formSubmit", data);
      triggerScreenshot("formSubmit");
    } catch (err) {
      console.error("Error in form submit handler:", err);
    }
  }
  
  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
           style.visibility !== 'hidden' &&
           style.display !== 'none';
  }

  let userInteracted = false;

  function markUserInteraction() {
    userInteracted = true;
    // Reset the flag after a short period (e.g., 500ms) so that later mutations aren’t mistakenly captured.
    setTimeout(() => { userInteracted = false; }, 500);
  }  

  function observeDynamicContent() {
    let dynamicContentTimeout = null;
    const dynamicContentObserver = new MutationObserver((mutationList) => {
      let newVisibleContent = false;
      // Check added nodes for visibility
      for (const mutation of mutationList) {
        if (mutation.type === "childList" && mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE &&
                isElementInViewport(node) &&
                isElementVisible(node)) {
              newVisibleContent = true;
            }
          });
        }
        if (newVisibleContent) break;
      }
      if (newVisibleContent) {
        // Use a debounce to wait for multiple rapid changes to settle
        if (dynamicContentTimeout) clearTimeout(dynamicContentTimeout);
        dynamicContentTimeout = setTimeout(() => {
          // Log a dynamic content load event and trigger a screenshot
          logEvent("dynamicContentLoad", { mutationCount: mutationList.length });
          triggerScreenshot("dynamicContentLoad");
        }, 500);
      }
    });
    
    // Observe the whole document for childList changes (and optionally attribute changes if needed)
    dynamicContentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    
    return dynamicContentObserver;
  }

  function observeDomMutations() {
    const observer = new MutationObserver((mutationList) => {
      // Only proceed if there was a recent user interaction.
      if (!userInteracted) return;
  
      let visibleChange = false;
  
      // Check each mutation for visible changes in the viewport.
      for (const mutation of mutationList) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE &&
                isElementInViewport(node) &&
                isElementVisible(node)) {
              visibleChange = true;
            }
          });
        } else if (mutation.type === "attributes") {
          if (mutation.target &&
              isElementInViewport(mutation.target) &&
              isElementVisible(mutation.target)) {
            visibleChange = true;
          }
        }
        if (visibleChange) break;
      }
  
      // Only trigger the screenshot if a visible change occurred.
      if (visibleChange) {
        // Use requestAnimationFrame to let the UI settle before capturing.
        requestAnimationFrame(() => {
          logEvent("domMutation", { mutationCount: mutationList.length });
        });
        // Reset the flag after capturing.
        userInteracted = false;
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }
  
  function attachEventListeners() {
    document.addEventListener("click", handleClick, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    document.addEventListener("input", handleInput);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    document.addEventListener("submit", handleFormSubmit, true);


    // Start observing DOM mutations
    observeDomMutations();

    observeDynamicContent();

    
    // Optionally, you can remove the immediate urlInit if not needed:
    // logEvent("urlInit", { url: window.location.href });
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
    document.removeEventListener("submit", handleFormSubmit, true);
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
  
  // Wait for the DOM to be stable after the window load event
  function waitForStableDOM(callback, debounceTime = 100) {
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        observer.disconnect();
        callback();
      }, debounceTime);
    });
  
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  
    // In case there are no mutations at all, trigger callback after debounceTime.
    timer = setTimeout(() => {
      observer.disconnect();
      callback();
    }, debounceTime);
  }
  
  // Listen for the window load, then wait for the DOM to settle before logging "pageLoad"
  window.addEventListener("load", () => {
    waitForStableDOM(() => {
      logEvent("pageLoad", { url: window.location.href });
    });
  });
  
  console.log("LiteExport module loaded (conditional initialization enabled).");
  
  // Signal that the content script is ready.
  chrome.runtime.sendMessage({ action: "contentScriptReady" });
})();
