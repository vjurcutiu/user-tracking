// src/domSnapshot.js

// Store recorded mutations in an array.
let domMutations = [];

// Reference to the MutationObserver instance.
let observer = null;

/**
 * Captures a snapshot of the entire DOM at the moment this function is called.
 * @returns {string} The outer HTML of the document element.
 */
export function captureInitialDomSnapshot() {
  return document.documentElement.outerHTML;
}

/**
 * Callback function for the MutationObserver.
 * @param {MutationRecord[]} mutationList - Array of mutations.
 */
function mutationCallback(mutationList) {
  mutationList.forEach((mutation) => {
    // Record a summary of each mutation
    domMutations.push({
      type: mutation.type,
      target: mutation.target.nodeName,
      addedNodes: mutation.addedNodes.length,
      removedNodes: mutation.removedNodes.length,
      attributeName: mutation.attributeName,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Starts observing DOM changes using a MutationObserver.
 * Resets any previously recorded mutations.
 */
export function startObservingDom() {
  // Clear previous mutation records.
  domMutations = [];

  // Create a new MutationObserver instance if not already created.
  if (!observer) {
    observer = new MutationObserver(mutationCallback);
  }

  // Configure observer options: monitor child list changes, subtree changes, and attribute changes.
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
  });

  console.log('DOM MutationObserver started.');
}

/**
 * Stops observing DOM changes.
 */
export function stopObservingDom() {
  if (observer) {
    observer.disconnect();
    console.log('DOM MutationObserver stopped.');
  }
}

/**
 * Returns the array of recorded DOM mutations.
 * @returns {Array} Array of mutation records.
 */
export function getDomMutations() {
  return domMutations;
}
