// content.js
(function () {
    // Check if the script is already injected and listening
    if (window.FPS_Injected) {
        return;
    }
    window.FPS_Injected = true;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let originalOverflow = "";
    let originalX = 0;
    let originalY = 0;
    let fixedElements = [];

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Determine action
        if (request.action === "start_capture") {
            startCaptureProcess();
        } else if (request.action === "scrolling_continue") {
            if (window.captureNextStep) {
                window.captureNextStep();
            }
        } else if (request.action === "capture_failed") {
            cleanup();
            // Alert handled by popup or background now, but we can reset state
        }
    });

    function cleanup() {
        // Restore scrollbars
        document.documentElement.style.overflow = originalOverflow;
        // Restore position
        window.scrollTo(originalX, originalY);
        // Restore fixed elements
        fixedElements.forEach(item => {
            if (item.node) {
                item.node.style.visibility = item.originalVisibility;
                item.node.style.opacity = item.originalOpacity;
            }
        });
        fixedElements = [];
        window.captureNextStep = null;
    }

    async function startCaptureProcess() {
        originalOverflow = document.documentElement.style.overflow;
        originalX = window.scrollX;
        originalY = window.scrollY;

        // Hide scrollbars
        document.documentElement.style.overflow = "hidden";

        // Identify Fixed/Sticky Elements
        fixedElements = [];
        const allNodes = document.querySelectorAll('*');
        for (const node of allNodes) {
            const style = window.getComputedStyle(node);
            if (style.position === 'fixed' || style.position === 'sticky') {
                fixedElements.push({
                    node: node,
                    originalVisibility: style.visibility,
                    originalOpacity: style.opacity
                });
            }
        }

        // Get full dimensions
        const fullWidth = Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
            document.documentElement.clientWidth
        );
        const fullHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            document.documentElement.clientHeight
        );

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let currentX = 0;
        let currentY = 0;

        // Scroll to top-left
        window.scrollTo(0, 0);
        await wait(500);

        const positions = [];
        while (currentY < fullHeight) {
            currentX = 0;
            while (currentX < fullWidth) {
                positions.push({ x: currentX, y: currentY });
                currentX += viewportWidth;
            }
            currentY += viewportHeight;
        }

        let posIndex = 0;

        window.captureNextStep = async () => {
            if (posIndex >= positions.length) {
                // Done
                cleanup();

                chrome.runtime.sendMessage({
                    action: "capture_complete",
                    totalWidth: fullWidth,
                    totalHeight: fullHeight,
                    devicePixelRatio: window.devicePixelRatio
                });
                return;
            }

            // Hide fixed elements after first shot
            if (posIndex === 1) {
                fixedElements.forEach(item => {
                    if (item.node) {
                        item.node.style.visibility = 'hidden';
                    }
                });
                await wait(100);
            }

            const pos = positions[posIndex];
            window.scrollTo(pos.x, pos.y);

            await wait(800);

            chrome.runtime.sendMessage({
                action: "capture_visible_part",
                x: pos.x,
                y: pos.y,
                width: viewportWidth,
                height: viewportHeight,
                devicePixelRatio: window.devicePixelRatio
            });

            // Calculate progress to send back for UI
            posIndex++;
            const percent = Math.round((posIndex / positions.length) * 100);
            chrome.runtime.sendMessage({ action: "progress_update", percent: percent });
        };

        // Start loop
        window.captureNextStep();
    }
})();
