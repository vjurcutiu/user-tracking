// observers.js
import { logEvent, triggerScreenshot } from './eventHandlers.js';

export function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

export function isElementVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 &&
         style.visibility !== 'hidden' &&
         style.display !== 'none';
}

export function observeDynamicContent() {
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

export function observeDomMutations() {
  const observer = new MutationObserver((mutationList) => {
    // For this module, assume that if mutations occur while a user interaction has been marked,
    // we consider it significant. Adjust as needed.
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
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  return observer;
}

export function waitForStableDOM(callback, debounceTime = 100) {
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
