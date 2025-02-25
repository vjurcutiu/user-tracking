console.log("LiteExport content script loaded in top frame?", window.top === window.self);

(function() {
  // Only run in top frame
  if (window.top !== window.self) {
    return;
  }

  ////////////////////////////////////////////////////////////////
  // 1. Communication Module
  // - Handles incoming Chrome runtime messages and delegates actions.
  ////////////////////////////////////////////////////////////////
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

  ////////////////////////////////////////////////////////////////
  // 2. DOM Utility Module
  // - Contains helper functions for DOM element selection and XPath generation.
  ////////////////////////////////////////////////////////////////
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

  // Function to capture interactable elements on the page
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

  ////////////////////////////////////////////////////////////////
  // 3. Event Handling & Logging Module
  // - Contains event handlers and logging functionality.
  ////////////////////////////////////////////////////////////////
  let userInteracted = false;
  function markUserInteraction() {
    userInteracted = true;
    // Reset the flag after a short period (e.g., 500ms) so that later mutations aren’t mistakenly captured.
    setTimeout(() => { userInteracted = false; }, 500);
  }

  // Logs events and triggers screenshots for specific event types
  function logEvent(type, data) {
    const eventRecord = { type, timestamp: Date.now(), ...data };
    chrome.runtime.sendMessage({ action: "recordLiteEvent", liteEvent: eventRecord });

    if (type === "pageLoad" || type === "scrollMovement" || type === "domMutation") {
      triggerScreenshot(type);
    }
  }

  function triggerScreenshot(screenshotType) {
    chrome.runtime.sendMessage({ action: "takeScreenshot", screenshotType: screenshotType });
  }

  function handleClick(event) {
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

  function handleContextMenu(event) {
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
  function handleResize() {
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

  function handleInput(event) {
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

  function handleKeydown(event) {
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

  function handleUrlChange() {
    try {
      logEvent("urlChange", { url: window.location.href });
    } catch (err) {
      console.error("Error in URL change handler:", err);
    }
  }

  function handleFormSubmit(event) {
    try {
      markUserInteraction();
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

  ////////////////////////////////////////////////////////////////
  // 4. Mutation Observer & DOM Monitoring Module
  // - Observes and debounces DOM changes to log dynamic content or mutations.
  ////////////////////////////////////////////////////////////////
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

  function observeDynamicContent() {
    let dynamicContentTimeout = null;
    const dynamicContentObserver = new MutationObserver((mutationList) => {
      let newVisibleContent = false;
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
        if (dynamicContentTimeout) clearTimeout(dynamicContentTimeout);
        dynamicContentTimeout = setTimeout(() => {
          logEvent("dynamicContentLoad", { mutationCount: mutationList.length });
          triggerScreenshot("dynamicContentLoad");
        }, 500);
      }
    });

    dynamicContentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    return dynamicContentObserver;
  }

  function observeDomMutations() {
    const observer = new MutationObserver((mutationList) => {
      if (!userInteracted) return;
      let visibleChange = false;
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
      if (visibleChange) {
        requestAnimationFrame(() => {
          logEvent("domMutation", { mutationCount: mutationList.length });
        });
        userInteracted = false;
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  // Wait for the DOM to be stable after window load before executing a callback.
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

    timer = setTimeout(() => {
      observer.disconnect();
      callback();
    }, debounceTime);
  }

  ////////////////////////////////////////////////////////////////
  // 5. Event Listener Management & Initialization Module
  // - Attaches and removes event listeners and manages the overall tracking lifecycle.
  ////////////////////////////////////////////////////////////////
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

    // Start observing DOM mutations and dynamic content.
    observeDomMutations();
    observeDynamicContent();
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

  ////////////////////////////////////////////////////////////////
  // Additional Initialization
  // - Wait for the DOM to stabilize and log the page load event.
  ////////////////////////////////////////////////////////////////
  window.addEventListener("load", () => {
    waitForStableDOM(() => {
      logEvent("pageLoad", { url: window.location.href });
    });
  });

  console.log("LiteExport module loaded (conditional initialization enabled).");

  // Signal that the content script is ready.
  chrome.runtime.sendMessage({ action: "contentScriptReady" });
})();
