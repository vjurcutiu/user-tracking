// downloadHelper.js
export function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  }
  
  export function downloadDataUrl(dataUrl, filename, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: dataUrl,
        filename,
        ...options
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(downloadId);
        }
      });
    });
  }
  