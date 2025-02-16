// Import necessary utility functions
import { buildInteractionData, safeSendMessage } from './utils.js';

/* Existing Handlers */

// Handles generic user interactions (e.g., clicks, inputs, keydowns)
export function handleUserInteraction(event) {
  const interactionData = buildInteractionData(event);
  safeSendMessage({ interactionData });
}

// Handles mouse movement with throttling applied in init.js
export function handleMouseMove(event) {
  const mouseData = {
    type: 'mousemove',
    timestamp: new Date().toISOString(),
    coordinates: {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    },
    url: window.location.href,
  };
  safeSendMessage({ interactionData: mouseData });
}

// Handles context menu (right-click) events
export function handleContextMenu(event) {
  const interactionData = {
    type: 'contextmenu',
    target: event.target.tagName,
    id: event.target.id || null,
    classes: event.target.className || null,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    mouseCoordinates: {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    },
  };
  safeSendMessage({ interactionData });
}

/* New Handlers */

// Handle window resize events
export function handleResize(event) {
  const interactionData = {
    type: 'resize',
    timestamp: new Date().toISOString(),
    windowSize: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    url: window.location.href,
  };
  safeSendMessage({ interactionData });
}

// Handle form submission events (e.g., contact forms)
export function handleFormSubmission(event) {
  // Optionally, prevent the default form submission if you need to capture data first
  // event.preventDefault();
  
  const form = event.target;
  const interactionData = {
    type: 'formSubmission',
    timestamp: new Date().toISOString(),
    formId: form.id || null,
    formAction: form.action || null,
    url: window.location.href,
  };
  safeSendMessage({ interactionData });
}
