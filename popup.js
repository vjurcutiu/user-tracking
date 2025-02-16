document.addEventListener('DOMContentLoaded', () => {
    const viewDataButton = document.getElementById('viewData');
    const saveDataButton = document.getElementById('saveData');
    const clearLogButton = document.getElementById('clearLog');
    const dataDisplay = document.getElementById('dataDisplay');
  
    // View Data Button
    viewDataButton.addEventListener('click', () => {
      chrome.storage.local.get({ records: [] }, (result) => {
        if (chrome.runtime.lastError) {
          dataDisplay.textContent = 'Error loading data!';
          return;
        }
        dataDisplay.textContent = JSON.stringify(result.records, null, 2);
      });
    });
  
    // Save Data Button (Excluding DOM Snapshots)
    saveDataButton.addEventListener('click', () => {
      chrome.storage.local.get({ records: [] }, (result) => {
        if (chrome.runtime.lastError) {
          alert('Error loading data!');
          return;
        }
  
        const data = result.records.map(record => ({
          interactionData: record.interactionData, // Only include interaction data
        }));
  
        if (data.length === 0) {
          alert('No actions recorded!');
          return;
        }
  
        // Create a Blob from the filtered data
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  
        // Create a link to download the blob
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'actions_without_dom.json';
        a.click();
  
        // Cleanup
        URL.revokeObjectURL(url);
      });
    });
  
    // Clear Log Button
    clearLogButton.addEventListener('click', () => {
      chrome.storage.local.set({ records: [] }, () => {
        if (chrome.runtime.lastError) {
          alert('Error clearing log!');
          return;
        }
        dataDisplay.textContent = 'Log cleared!';
        alert('Log has been cleared successfully.');
      });
    });
  });
  