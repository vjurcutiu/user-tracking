# Installation Instructions for Chrome Extension

## How to Install the Unpackaged Extension

1. Open Chrome and navigate to the extensions page by entering `chrome://extensions` in the address bar and pressing **Enter**.
2. Enable Developer Mode:
   - Toggle **Developer mode** on (located in the top-right corner of the extensions page).
3. Click `Load unpacked`:
   - A button labeled **"Load unpacked"** will appear. Click it.
4. Select the Extension Folder:
   - In the file browser that opens, navigate to the folder containing your unpackaged extension files (including the `manifest.json` file).
   - Select the folder and click **Open**.
5. Verify Installation:
   - The extension will appear in the list of installed extensions.
   - Ensure that it is enabled (toggle the switch to "on" if needed).


## Setting up the new version

1. Run npm install to install all the dependencies.
2. Run npm start build to create the code bundle.
3. Add the extension to the browser.
4. Press CTRL+Shift+Z to start/stop recording. When the recording is stopped, you will be prompted to save the recording.
5. Open replay.html in browser, and add the previously saved recording file. The recording can now be replayed in the browser. Feature is not fully developed yet so there may be some issues. 