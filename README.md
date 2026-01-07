# FullPage Snap - Professional Chrome Screenshot Extension

FullPage Snap is a powerful, lightweight Chrome extension designed to capture entire web pages and provide a suite of professional editing tools immediately after capture. Built with modern web standards (Manifest V3), it ensures privacy, speed, and reliability.

## Key Features

### 📸 Smart Full-Page Capture
*   **Intelligent Scrolling**: Automatically scrolls through the page to capture every pixel.
*   **Sticky Element Handling**: Smartly hides fixed headers and footers during capture to prevent duplication in the final image.
*   **Progress Feedback**: Real-time progress updates on the extension badge and popup.

### 🎨 Advanced Image Editor
Once captured, the image opens in a feature-rich editor tab:
*   **Drawing Tools**: Freehand Draw, Rectangle, Circle, and Arrow tools.
*   **Smart Shapes**:
    *   **Resizable**: Adjust dimensions using 8-point handles (corners + sides).
    *   **Movable**: Drag and drop text and shapes precisely.
*   **Text Tool**: Add annotations with adjustable font size and color. Text remains editable and movable until finalized.
*   **Zoom Controls**: Zoom In/Out, Fit to Screen, or set a custom percentage for pixel-perfect editing.
*   **History**: Full Undo/Redo support for peace of mind.

### 🚀 Export & Sharing
*   **Copy to Clipboard**: One-click copy to paste directly into Slack, Teams, or Docs.
*   **Export as PDF**: Generate a high-quality PDF of the full page.
*   **Save as PNG**: Download the verified high-resolution image.

## Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (top right toggle).
4.  Click **Load unpacked**.
5.  Select the extension directory.

## Usage

1.  **Pin** the FullPage Snap icon to your browser toolbar for easy access.
2.  Navigate to any web page you want to capture.
3.  Click the extension icon and hit **Capture Full Page**.
4.  Wait for the capture to complete (do not switch tabs during scrolling).
5.  Edit your screenshot in the new tab and Export!

## Privacy & Permissions
*   **activeTab**: Only accesses the current tab when clicked.
*   **scripting**: Used to perform the scrolling capture logic.
*   **unlimitedStorage**: Ensures long pages (large images) are saved successfully.
*   **No Tracking**: This extension works entirely offline within your browser. No data is sent to external servers.

---
*Built with ❤️ using Vanilla JS and CSS for maximum performance.*
