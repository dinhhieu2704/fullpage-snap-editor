// background.js

let captureref = {};

chrome.action.onClicked.addListener(async (tab) => {
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
        console.warn("Cannot capture browser internal pages.");
        return;
    }

    // Inject content script if not already present, or just send a message to start
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
        });

        // Initialize capture state
        captureref[tab.id] = {
            screenshots: [],
            pixelRatio: 1 // Default, will update from content script
        };

        // Start the process
        chrome.tabs.sendMessage(tab.id, { action: "start_capture" });
    } catch (err) {
        console.error("Failed to inject script: ", err);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab.id;

    if (message.action === "capture_visible_part") {
        // Capture the visible tab
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
                console.error("Capture failed:", chrome.runtime.lastError);
                // Abort or try to continue
                chrome.tabs.sendMessage(tabId, { action: "capture_failed" });
                return;
            }

            if (!captureref[tabId]) captureref[tabId] = { screenshots: [] };

            captureref[tabId].screenshots.push({
                dataUrl: dataUrl,
                x: message.x,
                y: message.y,
                width: message.width,
                height: message.height,
                devicePixelRatio: message.devicePixelRatio
            });

            // Tell content script to scroll more
            chrome.tabs.sendMessage(tabId, { action: "scrolling_continue" });
        });
    }
    else if (message.action === "capture_complete") {
        const finalData = {
            screenshots: captureref[tabId].screenshots,
            totalWidth: message.totalWidth,
            totalHeight: message.totalHeight,
            devicePixelRatio: message.devicePixelRatio
        };

        // Store data in local storage to pass to editor (avoid URL length limits)
        chrome.storage.local.set({ "captured_data": finalData }, () => {
            chrome.tabs.create({ url: "editor.html" });
            // cleanup
            delete captureref[tabId];
        });
    }
});
