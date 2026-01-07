// editor.js

const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Tools Buttons
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnDraw = document.getElementById('btn-draw');
const btnRect = document.getElementById('btn-rect');
const btnCircle = document.getElementById('btn-circle');
const btnArrow = document.getElementById('btn-arrow');
const btnText = document.getElementById('btn-text');

// Settings
const sizeSlider = document.getElementById('line-width');
const sizeVal = document.getElementById('size-val');
const colorRadios = document.querySelectorAll('input[name="color"]');
const customColorInput = document.getElementById('custom-color-input');
const btnDownload = document.getElementById('btn-download');
// const btnDelete = document.getElementById('btn-delete');

let currentTool = 'draw';
let isDragging = false;
let startX, startY;
let currentColor = '#1313ec'; // Default primary blue

// State Management
let history = [];
let historyIndex = -1;
let backgroundData = null;

// Active Object
let activeObject = null;
let isMovingActiveObject = false;
let isResizingActiveObject = false;
let resizeHandle = null;
let moveOffsetX, moveOffsetY;
let initialResizeState = null;

const HANDLE_SIZE = 10;
const HANDLE_OFFSET = HANDLE_SIZE / 2;

// Text Input Overlay
let textInput = null;

// --- Initialization ---

chrome.storage.local.get(['captured_data'], (result) => {
    if (result.captured_data) {
        initCanvas(result.captured_data);
        // chrome.storage.local.remove(['captured_data']); // Optional: Keep for debugging
    }
});

function initCanvas(data) {
    const { screenshots, totalWidth, totalHeight, devicePixelRatio } = data;
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    // Draw initial screenshots
    screenshots.forEach(shot => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, shot.x, shot.y, shot.width, shot.height);
        };
        img.src = shot.dataUrl;
    });

    // Wait 500ms to ensure images draw then save state
    setTimeout(() => {
        saveState();
    }, 500);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    updateSettings();
}

function updateSettings() {
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = parseInt(sizeSlider.value, 10);
}

// --- History System (Undo/Redo) ---

function saveState() {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    historyIndex++;
    backgroundData = history[historyIndex];
    updateUndoRedoUI();
}

function undo() {
    if (historyIndex > 0) {
        activeObject = null;
        removeTextInput();

        historyIndex--;
        ctx.putImageData(history[historyIndex], 0, 0);
        backgroundData = history[historyIndex];
        updateUndoRedoUI();
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        activeObject = null;
        removeTextInput();

        historyIndex++;
        ctx.putImageData(history[historyIndex], 0, 0);
        backgroundData = history[historyIndex];
        updateUndoRedoUI();
    }
}

function updateUndoRedoUI() {
    btnUndo.disabled = historyIndex <= 0;
    btnRedo.disabled = historyIndex >= history.length - 1;
    btnUndo.style.opacity = btnUndo.disabled ? 0.3 : 1;
    btnRedo.style.opacity = btnRedo.disabled ? 0.3 : 1;
}

// --- Active Object & Rendering ---

function commitActiveObject() {
    if (!activeObject) return;
    // Clear potentially drawn selection handles by restoring clean background
    if (backgroundData) {
        ctx.putImageData(backgroundData, 0, 0);
    }
    drawObject(activeObject);
    saveState();
    activeObject = null;
    removeTextInput(); // Ensure input is removed if it was text
}

function deleteActiveObject() {
    if (activeObject) {
        activeObject = null;
        removeTextInput();
        render();
    }
}

function drawObject(obj) {
    ctx.beginPath();
    ctx.strokeStyle = obj.color;
    ctx.fillStyle = obj.color;
    ctx.lineWidth = obj.width;

    if (obj.type === 'rect') {
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    } else if (obj.type === 'circle') {
        let radiusX = Math.abs(obj.w) / 2;
        let radiusY = Math.abs(obj.h) / 2;
        let centerX = obj.x + obj.w / 2;
        let centerY = obj.y + obj.h / 2;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (obj.type === 'arrow') {
        drawArrow(ctx, obj.x, obj.y, obj.x + obj.w, obj.y + obj.h, obj.width);
    } else if (obj.type === 'text') {
        ctx.save();
        ctx.textBaseline = 'top';
        ctx.font = `${obj.width * 5}px sans-serif`;
        ctx.fillText(obj.text, obj.x, obj.y);
        ctx.restore();
    }
}

function drawArrow(ctx, fromX, fromY, toX, toY, width) {
    const headLength = width * 4;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

function render() {
    if (!backgroundData) return;
    ctx.putImageData(backgroundData, 0, 0);

    if (activeObject) {
        // If text and we are editing (input exists), don't draw text on canvas (avoid double)
        if (activeObject.type === 'text' && textInput) {
            return;
        }
        drawObject(activeObject);
        drawSelectionFrame(activeObject);
    }
}

function drawSelectionFrame(obj) {
    ctx.save();
    ctx.strokeStyle = '#00a8ff';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ffffff';
    ctx.setLineDash([5, 5]);

    if (obj.type === 'arrow') {
        // Arrow: Draw dashed line and handles at Start/End
        const startX = obj.x;
        const startY = obj.y;
        const endX = obj.x + obj.w;
        const endY = obj.y + obj.h;

        // Line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.setLineDash([]);
        // Handle 1 (Start)
        ctx.fillRect(startX - HANDLE_OFFSET, startY - HANDLE_OFFSET, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(startX - HANDLE_OFFSET, startY - HANDLE_OFFSET, HANDLE_SIZE, HANDLE_SIZE);

        // Handle 2 (End)
        ctx.fillRect(endX - HANDLE_OFFSET, endY - HANDLE_OFFSET, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(endX - HANDLE_OFFSET, endY - HANDLE_OFFSET, HANDLE_SIZE, HANDLE_SIZE);

    } else {
        // Rect/Circle: Bounding box handles
        const nObj = getNormalizedGeometry(obj);
        ctx.strokeRect(nObj.x, nObj.y, nObj.w, nObj.h);

        // Draw Handles
        ctx.setLineDash([]);

        // 8 handles
        const handles = [
            { x: nObj.x - HANDLE_OFFSET, y: nObj.y - HANDLE_OFFSET, type: 'nw' },
            { x: nObj.x + nObj.w - HANDLE_OFFSET, y: nObj.y - HANDLE_OFFSET, type: 'ne' },
            { x: nObj.x - HANDLE_OFFSET, y: nObj.y + nObj.h - HANDLE_OFFSET, type: 'sw' },
            { x: nObj.x + nObj.w - HANDLE_OFFSET, y: nObj.y + nObj.h - HANDLE_OFFSET, type: 'se' },

            // Side handles
            { x: nObj.x + nObj.w / 2 - HANDLE_OFFSET, y: nObj.y - HANDLE_OFFSET, type: 'n' },           // Top
            { x: nObj.x + nObj.w / 2 - HANDLE_OFFSET, y: nObj.y + nObj.h - HANDLE_OFFSET, type: 's' },  // Bottom
            { x: nObj.x - HANDLE_OFFSET, y: nObj.y + nObj.h / 2 - HANDLE_OFFSET, type: 'w' },           // Left
            { x: nObj.x + nObj.w - HANDLE_OFFSET, y: nObj.y + nObj.h / 2 - HANDLE_OFFSET, type: 'e' }   // Right
        ];

        handles.forEach(h => {
            ctx.fillRect(h.x, h.y, HANDLE_SIZE, HANDLE_SIZE);
            ctx.strokeRect(h.x, h.y, HANDLE_SIZE, HANDLE_SIZE);
        });
    }
    ctx.restore();
}

// --- Interaction Helpers ---

function getNormalizedGeometry(obj) {
    let nx = obj.x;
    let ny = obj.y;
    let nw = obj.w;
    let nh = obj.h;
    if (nw < 0) { nx += nw; nw = -nw; }
    if (nh < 0) { ny += nh; nh = -nh; }
    return { x: nx, y: ny, w: nw, h: nh };
}

function getHandleAt(mouseX, mouseY, obj) {
    if (!obj || obj.type === 'text') return null;

    const hitBox = (hx, hy) => {
        return (mouseX >= hx && mouseX <= hx + HANDLE_SIZE &&
            mouseY >= hy && mouseY <= hy + HANDLE_SIZE);
    };

    if (obj.type === 'arrow') {
        if (hitBox(obj.x - HANDLE_OFFSET, obj.y - HANDLE_OFFSET)) return 'start';
        if (hitBox(obj.x + obj.w - HANDLE_OFFSET, obj.y + obj.h - HANDLE_OFFSET)) return 'end';
        return null;
    }

    // Generic box handles
    const nObj = getNormalizedGeometry(obj);
    if (hitBox(nObj.x - HANDLE_OFFSET, nObj.y - HANDLE_OFFSET)) return 'nw';
    if (hitBox(nObj.x + nObj.w - HANDLE_OFFSET, nObj.y - HANDLE_OFFSET)) return 'ne';
    if (hitBox(nObj.x - HANDLE_OFFSET, nObj.y + nObj.h - HANDLE_OFFSET)) return 'sw';
    if (hitBox(nObj.x + nObj.w - HANDLE_OFFSET, nObj.y + nObj.h - HANDLE_OFFSET)) return 'se';

    // Side handles
    if (hitBox(nObj.x + nObj.w / 2 - HANDLE_OFFSET, nObj.y - HANDLE_OFFSET)) return 'n';
    if (hitBox(nObj.x + nObj.w / 2 - HANDLE_OFFSET, nObj.y + nObj.h - HANDLE_OFFSET)) return 's';
    if (hitBox(nObj.x - HANDLE_OFFSET, nObj.y + nObj.h / 2 - HANDLE_OFFSET)) return 'w';
    if (hitBox(nObj.x + nObj.w - HANDLE_OFFSET, nObj.y + nObj.h / 2 - HANDLE_OFFSET)) return 'e';

    return null;
}

function isPointInObject(x, y, obj) {
    if (!obj) return false;

    if (obj.type === 'arrow') {
        // Line distance check
        // Vector AB
        const x1 = obj.x; const y1 = obj.y;
        const x2 = obj.x + obj.w; const y2 = obj.y + obj.h;

        // Distance from point (x,y) to line segment (x1,y1)-(x2,y2)
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1; yy = y1;
        } else if (param > 1) {
            xx = x2; yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Tolerance: 5px + stroke width/2
        return dist < (5 + (obj.width || 3) / 2);
    }

    // Box check
    const nObj = getNormalizedGeometry(obj);
    return (x >= nObj.x && x <= nObj.x + nObj.w && y >= nObj.y && y <= nObj.y + nObj.h);
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// --- Text Tool ---
function createTextInput(x, y) {
    removeTextInput();
    const wrapper = document.getElementById('canvas-wrapper');
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'absolute';

    // Position relative to the container (wrapper)
    // Coords x,y are INTERNAL CANVAS coords. 
    // VISUAL coords on screen = x * currentZoom, y * currentZoom
    // Add canvas offset within the wrapper (it might have auto margin)

    const visualX = (x * currentZoom) + canvas.offsetLeft;
    const visualY = (y * currentZoom) + canvas.offsetTop;

    input.style.left = visualX + 'px';
    input.style.top = visualY + 'px';
    input.style.zIndex = 1000;

    // Scale font size visually as well
    // internal font size = sizeSlider.value * 5
    // visual font size = internal * currentZoom
    const fontSize = (parseInt(sizeSlider.value, 10) * 5 * currentZoom);
    input.style.fontSize = Math.max(10, fontSize) + 'px';

    input.style.color = currentColor;
    input.style.background = 'transparent';
    input.style.border = '1px dashed #ffffff';
    input.style.padding = '0';
    input.style.margin = '0';
    input.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
    input.style.outline = 'none';
    input.style.minWidth = '50px';

    wrapper.appendChild(input);

    // Auto focus
    setTimeout(() => input.focus(), 0);

    activeObject = {
        type: 'text',
        x: x,
        y: y,
        text: '',
        color: currentColor,
        width: parseInt(sizeSlider.value, 10)
    };
    textInput = input;

    input.addEventListener('blur', () => {
        if (input.value.trim() === '') {
            removeTextInput();
            activeObject = null;
            return;
        }

        activeObject.text = input.value;

        // Measure text for hit testing / bounding box
        ctx.save();
        ctx.font = `${activeObject.width * 5}px sans-serif`;
        const metrics = ctx.measureText(activeObject.text);
        activeObject.w = metrics.width;
        activeObject.h = (activeObject.width * 5); // Approximate height from font size sizeSlider * 5
        ctx.restore();

        // Don't commit yet, keep it active so we can move/edit it
        // commitActiveObject(); 
        removeTextInput();
        render();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
    });
}

function removeTextInput() {
    if (textInput) {
        if (textInput.parentNode) {
            textInput.parentNode.removeChild(textInput);
        }
        textInput = null;
    }
}

// --- Listeners ---

function updateCursor(x, y) {
    if (isResizingActiveObject) return;

    if (activeObject) {
        if (activeObject.type !== 'text') {
            const handle = getHandleAt(x, y, activeObject);
            if (handle) {
                if (activeObject.type === 'arrow') {
                    canvas.style.cursor = 'crosshair';
                    return;
                }
                // Resize cursors
                if (handle === 'nw' || handle === 'se') canvas.style.cursor = 'nwse-resize';
                else if (handle === 'ne' || handle === 'sw') canvas.style.cursor = 'nesw-resize';
                else if (handle === 'n' || handle === 's') canvas.style.cursor = 'ns-resize';
                else if (handle === 'w' || handle === 'e') canvas.style.cursor = 'ew-resize';
                return;
            }
        }
        if (isPointInObject(x, y, activeObject)) {
            canvas.style.cursor = 'move';
            return;
        }
    }

    if (currentTool === 'text') {
        canvas.style.cursor = 'text';
    } else {
        canvas.style.cursor = 'crosshair';
    }
}

// ... setActiveTool ...
function setActiveTool(tool, btn) {
    commitActiveObject();
    currentTool = tool;

    // UI Updates
    const buttons = [btnDraw, btnRect, btnCircle, btnArrow, btnText];
    buttons.forEach(b => {
        b.className = "tool-btn";
    });

    // Activate style
    if (btn) {
        btn.className = "tool-btn active";
    }
}

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;
    updateSettings();

    // 1. Check Handle Hit (Resize)
    if (activeObject && activeObject.type !== 'text') {
        const handle = getHandleAt(pos.x, pos.y, activeObject);
        if (handle) {
            isResizingActiveObject = true;
            resizeHandle = handle;
            initialResizeState = { ...activeObject };
            return;
        }
    }

    // 2. Check Body Hit (Move)
    if (activeObject && isPointInObject(pos.x, pos.y, activeObject)) {
        isMovingActiveObject = true;
        moveOffsetX = pos.x - activeObject.x;
        moveOffsetY = pos.y - activeObject.y;
        return;
    }

    // 3. New Object
    if (activeObject) {
        commitActiveObject();
    }

    if (currentTool === 'draw') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
    } else if (['rect', 'circle', 'arrow'].includes(currentTool)) {
        activeObject = {
            type: currentTool,
            x: startX,
            y: startY,
            w: 0,
            h: 0,
            color: currentColor,
            width: parseInt(sizeSlider.value, 10)
        };
    } else if (currentTool === 'text') {
        createTextInput(startX, startY);
        isDragging = false;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    updateCursor(pos.x, pos.y);

    if (!isDragging) return;

    if (isMovingActiveObject && activeObject) {
        activeObject.x = pos.x - moveOffsetX;
        activeObject.y = pos.y - moveOffsetY;
        render();
        return;
    }

    if (isResizingActiveObject && activeObject) {
        const init = initialResizeState;

        if (activeObject.type === 'arrow') {
            const endX = init.x + init.w;
            const endY = init.y + init.h;

            if (resizeHandle === 'start') {
                activeObject.x = pos.x;
                activeObject.y = pos.y;
                activeObject.w = endX - pos.x;
                activeObject.h = endY - pos.y;
            } else if (resizeHandle === 'end') {
                activeObject.w = pos.x - init.x;
                activeObject.h = pos.y - init.y;
            }
        } else {
            // Rect/Circle Logic
            if (resizeHandle === 'se') {
                activeObject.w = pos.x - init.x;
                activeObject.h = pos.y - init.y;
            } else if (resizeHandle === 'sw') {
                activeObject.x = pos.x;
                activeObject.w = (init.x + init.w) - pos.x;
                activeObject.h = pos.y - init.y;
            } else if (resizeHandle === 'ne') {
                activeObject.y = pos.y;
                activeObject.w = pos.x - init.x;
                activeObject.h = (init.y + init.h) - pos.y;
            } else if (resizeHandle === 'nw') {
                activeObject.x = pos.x;
                activeObject.y = pos.y;
                activeObject.w = (init.x + init.w) - pos.x;
                activeObject.h = (init.y + init.h) - pos.y;
            }
            // Side Handles
            else if (resizeHandle === 'e') {
                // Width only, from right
                activeObject.w = pos.x - init.x;
            } else if (resizeHandle === 'w') {
                // Width only, from left
                activeObject.x = pos.x;
                activeObject.w = (init.x + init.w) - pos.x;
            } else if (resizeHandle === 's') {
                // Height only, from bottom
                activeObject.h = pos.y - init.y;
            } else if (resizeHandle === 'n') {
                // Height only, from top
                activeObject.y = pos.y;
                activeObject.h = (init.y + init.h) - pos.y;
            }
        }
        render();
        return;
    }

    if (currentTool === 'draw') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (['rect', 'circle', 'arrow'].includes(currentTool)) {
        if (activeObject) {
            activeObject.w = pos.x - startX;
            activeObject.h = pos.y - startY;
            render();
        }
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    isMovingActiveObject = false;
    isResizingActiveObject = false;
    initialResizeState = null;

    if (currentTool === 'draw') {
        ctx.closePath();
        saveState();
    }
});


// Event Wiring
btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);
// btnDelete.addEventListener('click', deleteActiveObject);

btnDraw.addEventListener('click', () => setActiveTool('draw', btnDraw));
btnRect.addEventListener('click', () => setActiveTool('rect', btnRect));
btnCircle.addEventListener('click', () => setActiveTool('circle', btnCircle));
btnArrow.addEventListener('click', () => setActiveTool('arrow', btnArrow));
btnText.addEventListener('click', () => setActiveTool('text', btnText));

// Handle Color Radios
colorRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentColor = e.target.value;
        updateSettings();
        if (activeObject) {
            activeObject.color = currentColor;
            render();
        }
    });
});

// Custom Color Input
customColorInput.addEventListener('input', (e) => {
    currentColor = e.target.value;
    colorRadios.forEach(r => r.checked = false);
    updateSettings();
    if (activeObject) {
        activeObject.color = currentColor;
        render();
    }
});

sizeSlider.addEventListener('input', (e) => {
    sizeVal.textContent = `${e.target.value}px`;
    updateSettings();
    if (activeObject) {
        activeObject.width = parseInt(e.target.value, 10);
        if (activeObject.type === 'text') {
            ctx.save();
            ctx.font = `${activeObject.width * 5}px sans-serif`;
            const metrics = ctx.measureText(activeObject.text);
            activeObject.w = metrics.width;
            activeObject.h = (activeObject.width * 5);
            ctx.restore();
        }
        render();
    }
});

btnDownload.addEventListener('click', () => {
    commitActiveObject();
    const link = document.createElement('a');
    link.download = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.href = canvas.toDataURL();
    link.click();
});

// Copy to Clipboard
// Copy to Clipboard
const btnCopy = document.getElementById('btn-copy');
if (btnCopy) {
    btnCopy.addEventListener('click', () => {
        commitActiveObject();
        canvas.toBlob(blob => {
            if (!blob) return;
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(() => {
                    const originalText = btnCopy.innerHTML;
                    btnCopy.innerHTML = '<span class="material-symbols-outlined">check</span>';
                    setTimeout(() => {
                        btnCopy.innerHTML = originalText;
                    }, 1000);
                }).catch(err => {
                    console.error('Copy failed: ', err);
                    alert('Failed to copy. Permissions may be denied.');
                });
            } catch (e) {
                alert('Clipboard API not supported.');
            }
        });
    });
}

// Export PDF (using Print)
const btnPdf = document.getElementById('btn-pdf');
if (btnPdf) {
    btnPdf.addEventListener('click', () => {
        commitActiveObject();
        const dataUrl = canvas.toDataURL('image/png');
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print / Save as PDF</title>
                        <style>
                            body { margin: 0; padding: 0; display: flex; justify-content: center; background: #555; }
                            img { max-width: 100%; height: auto; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
                            @media print {
                                body { background: white; display: block; }
                                img { box-shadow: none; width: 100%; height: auto; }
                            }
                        </style>
                    </head>
                    <body>
                        <img src="${dataUrl}" onload="window.print();" />
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    });
}

// --- Zoom Logic ---
let currentZoom = 1.0;
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnFit = document.getElementById('btn-fit');
const zoomInput = document.getElementById('zoom-input');

function setZoom(zoom) {
    // Clamp zoom 0.1 to 5.0
    zoom = Math.max(0.1, Math.min(5.0, zoom));
    currentZoom = zoom;

    // Update Canvas Style Size
    // Internal resolution (width/height) remains same.
    // CSS width/height changes.
    const newWidth = canvas.width * currentZoom;
    const newHeight = canvas.height * currentZoom;

    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    // Update Input
    zoomInput.value = `${Math.round(currentZoom * 100)}%`;
}

btnZoomIn.addEventListener('click', () => {
    setZoom(currentZoom + 0.1);
});

btnZoomOut.addEventListener('click', () => {
    setZoom(currentZoom - 0.1);
});

btnFit.addEventListener('click', () => {
    // Fit to wrapper
    const wrapper = document.getElementById('canvas-wrapper');
    // We remove padding from calculation roughly
    const availW = wrapper.clientWidth - 64;
    const availH = wrapper.clientHeight - 64;

    const scaleW = availW / canvas.width;
    const scaleH = availH / canvas.height;

    // Fit whole image
    let scale = Math.min(scaleW, scaleH);
    // Limit to 100% if image is smaller than screen? No, let it upscale if user wants fit?
    // Usually "Fit" means "See All".
    setZoom(scale);
});

zoomInput.addEventListener('change', () => {
    let val = parseFloat(zoomInput.value);
    if (!isNaN(val)) {
        setZoom(val / 100);
    }
});

