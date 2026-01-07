document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btn-start');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    btnStart.addEventListener('click', async () => {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            alert('No active tab found.');
            return;
        }

        // Show UI
        btnStart.disabled = true;
        btnStart.style.display = 'none';
        progressContainer.style.display = 'block';

        // Send message to background to start
        chrome.runtime.sendMessage({ action: "start_capture_command", tabId: tab.id });
    });

    // Listen for progress
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "progress_update") {
            const percent = request.percent;
            progressFill.style.width = percent + '%';
            progressText.textContent = percent + '%';
        } else if (request.action === "capture_complete_notify") {
            // Done
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            setTimeout(() => {
                window.close(); // Close popup when done
            }, 500);
        } else if (request.action === "capture_error") {
            alert("Error: " + request.message);
            window.close();
        }
    });
});
