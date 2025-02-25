// downloadHelper.js

import pako from 'pako';


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

export function exportGenericData({
  exportType,       // e.g. 'rrweb', 'lite', ...
  events,           // the array (or object) of events to export
  filenamePrefix,   // e.g. 'rrweb-recording-', 'lite-recording-', ...
  compress = false  // whether to gzip (rrweb case) or not (lite case)
}) {
  if (!events) {
    console.error("No events provided for export.");
    return;
  }

  let json;
  try {
    json = JSON.stringify(events, null, 2);
  } catch (err) {
    console.error(`Failed to stringify ${exportType} events:`, err);
    return;
  }

  try {
    let dataUrl;
    let finalFilename;

    if (compress) {
      // Use pako to gzip
      const compressed = pako.gzip(json);
      let binaryString = '';
      for (let i = 0; i < compressed.length; i++) {
        binaryString += String.fromCharCode(compressed[i]);
      }
      const base64 = btoa(binaryString);
      dataUrl = `data:application/octet-stream;base64,${base64}`;

      // Gzipped JSON
      finalFilename = `${filenamePrefix}${Date.now()}.json.gz`;
    } else {
      // No compression, just base64 the plain JSON
      const base64 = btoa(json);
      dataUrl = `data:application/octet-stream;base64,${base64}`;

      // Plain JSON
      finalFilename = `${filenamePrefix}${Date.now()}.json`;
    }

    chrome.downloads.download({
      url: dataUrl,
      filename: finalFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, () => {
      console.log(`${exportType} export complete.`);
    });

  } catch (err) {
    console.error(`Failed to export ${exportType} events:`, err);
  }
}
