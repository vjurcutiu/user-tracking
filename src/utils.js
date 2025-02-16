// utils.js
export function buildInteractionData(event) {
    const interactionData = {
      type: event.type,
      target: event.target.tagName,
      id: event.target.id || null,
      classes: event.target.className || null,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    if (event.type === 'click') {
      interactionData.mouseCoordinates = {
        clientX: event.clientX,
        clientY: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
      };
    }
    return interactionData;
  }
  
  export function safeSendMessage(message) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.error('Extension context is unavailable. Cannot send message.');
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to send message:', chrome.runtime.lastError.message);
        } else if (response?.status !== 'success') {
          console.warn('Unexpected response:', response);
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
  
  export function debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), delay);
    };
  }
  
  export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  