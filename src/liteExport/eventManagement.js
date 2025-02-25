// eventManagement.js
import { handleClick, handleContextMenu, handleMouseMove, handleScroll, handleResize, handleInput, handleKeydown, handleUrlChange, handleFormSubmit } from './eventHandlers.js';
import { observeDomMutations, observeDynamicContent, waitForStableDOM } from './observers.js';

export function attachEventListeners() {
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

  // Begin observing dynamic content and DOM mutations.
  observeDomMutations();
  observeDynamicContent();
}

export function removeEventListeners() {
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
export function initializeTracking() {
  if (trackingInitialized) return;
  attachEventListeners();
  trackingInitialized = true;
  console.log("LiteExport tracking initialized.");
}

export function destroyTracking() {
  if (!trackingInitialized) return;
  removeEventListeners();
  trackingInitialized = false;
  console.log("LiteExport tracking destroyed.");
}
