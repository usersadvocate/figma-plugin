// Sections Detector Plugin (main entry point)

// Import services and handlers
import { handleUIMessage, handleSelectionChange } from "./services/events";
import type { UIMessage } from "./types";

// Initialize the plugin UI
figma.showUI(__html__, { width: 600, height: 500 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: UIMessage) => {
  if (msg.type === "resize") {
    const { width, height } = msg.size;
    figma.ui.resize(width, height);
    return;
  }

  await handleUIMessage(msg);
};

// Listen for selection changes and notify UI with the current section
figma.on("selectionchange", () => {
  handleSelectionChange();
});

console.log("🚀 Sections Detector Plugin initialized");
