// Sections Detector Plugin (main entry point)

// Import services and handlers
import {
  handleUIMessage,
  handleSelectionChange,
  attachDocumentChangeListener,
  startSectionsPolling,
} from "./services/events";
import type { UIMessage } from "./types";

// Initialize the plugin UI
figma.showUI(__html__, { width: 500, height: 400 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: UIMessage) => {
  await handleUIMessage(msg);
};

// Listen for selection changes and notify UI with the current section
figma.on("selectionchange", () => {
  handleSelectionChange();
});

// Set up document change monitoring
attachDocumentChangeListener();

// Start sections polling as a fallback
startSectionsPolling();

console.log("🚀 Sections Detector Plugin initialized");
