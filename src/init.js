import { record } from 'rrweb';

let isRecording = false;
let stopFn = null;

function startRecording() {
  if (isRecording) {
    console.log('Already recording, stopping old session first...');
    stopRecording();
  }
  isRecording = true;

  stopFn = record({
    emit(event) {
      chrome.runtime.sendMessage({ rrwebEvent: event }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to send rrwebEvent:', chrome.runtime.lastError.message);
        }
      });
    }
  });

  console.log('Recording started (full snapshot).');
}

function stopRecording() {
  if (!isRecording || !stopFn) return;
  isRecording = false;
  stopFn();
  stopFn = null;
  console.log('Recording stopped.');
}


window.addEventListener('beforeunload', () => {
  if (isRecording) {
    stopRecording();
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    startRecording();
    sendResponse({ status: 'started' });
  } else if (message.action === 'stop') {
    stopRecording();
    sendResponse({ status: 'stopped' });
  }
});

chrome.runtime.sendMessage({ action: 'contentScriptReady' });
console.log('rrweb content script loaded');
