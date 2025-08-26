// Event handling and message communication

import { getSections, getSelectedSectionId } from "./sections";
import { analyzeSectionContent } from "../analysis/nodes";
import { UIMessage } from "../types";

// Helper function to jump to a specific node in Figma
export async function jumpToNode(nodeId: string) {
  try {
    console.log("🔍 Jumping to node:", nodeId);
    const node = await figma.getNodeByIdAsync(nodeId);

    if (!node) {
      console.error("❌ Node not found:", nodeId);
      figma.ui.postMessage({
        type: "node-jumped",
        nodeName: "Unknown",
        nodeType: "Unknown",
      });
      return;
    }

    // Scroll to and select the node
    figma.currentPage.selection = [node as SceneNode];
    await figma.viewport.scrollAndZoomIntoView([node as SceneNode]);

    console.log(`✅ Successfully jumped to "${node.name}" (${node.type})`);

    // Notify UI about successful jump
    figma.ui.postMessage({
      type: "node-jumped",
      nodeName: node.name,
      nodeType: node.type,
    });
  } catch (error) {
    console.error("💥 Error jumping to node:", nodeId, error);
    figma.ui.postMessage({
      type: "node-jumped",
      nodeName: "Error",
      nodeType: "Error",
    });
  }
}

// Main message handler
export async function handleUIMessage(msg: UIMessage) {
  if (msg.type === "get-sections") {
    const sections = getSections();
    const selectedSectionId = getSelectedSectionId();
    figma.ui.postMessage({
      type: "sections-loaded",
      sections,
      selectedSectionId,
    });
  }

  if (msg.type === "analyze-section") {
    const analysis = await analyzeSectionContent(msg.sectionId);
    figma.ui.postMessage({ type: "section-analysis", analysis });
  }

  if (msg.type === "jump-to-node") {
    jumpToNode(msg.nodeId);
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
  }
}

// Selection change handler
export function handleSelectionChange() {
  const sectionId = getSelectedSectionId();
  figma.ui.postMessage({ type: "selection-section", sectionId });
}

// Debounced broadcaster for sections list
let pendingSectionsRefresh = false;
export function refreshSectionsDebounced() {
  if (pendingSectionsRefresh) return;
  pendingSectionsRefresh = true;
  setTimeout(() => {
    pendingSectionsRefresh = false;
    const sections = getSections();
    const selectedSectionId = getSelectedSectionId();
    figma.ui.postMessage({
      type: "sections-loaded",
      sections,
      selectedSectionId,
    });
  }, 100);
}

// Document change listener
export async function attachDocumentChangeListener() {
  try {
    // Load all pages to enable documentchange events
    await figma.loadAllPagesAsync();
    figma.on("documentchange", () => {
      console.log("📝 Document changed, refreshing sections list");
      refreshSectionsDebounced();
    });
    console.log("📝 Document change listener attached");
  } catch (error) {
    console.warn("Could not attach document change listener:", error);
    console.log("Falling back to polling only");
  }
}

// Sections polling (fallback for document change detection)
let sectionsPollingInterval: number | null = null;

export function startSectionsPolling() {
  if (sectionsPollingInterval) return; // Already polling

  sectionsPollingInterval = setInterval(() => {
    refreshSectionsDebounced();
  }, 2000); // Poll every 2 seconds

  console.log("🔄 Started sections polling");
}
