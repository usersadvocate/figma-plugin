// Event handling and message communication

import { getSelectedContainerId } from "./sections";
import { analyzeContainerContent } from "../analysis/nodes";
import { auditContainer } from "../analysis/audit";
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
    // No longer needed - we use direct selection instead of dropdown
    console.log("get-sections called but no longer needed");
  }

  if (msg.type === "analyze-section") {
    const analysis = await analyzeContainerContent(msg.sectionId);
    figma.ui.postMessage({ type: "section-analysis", analysis });
  }

  if (msg.type === "audit-container") {
    const audit = await auditContainer(msg.containerId);
    figma.ui.postMessage({ type: "audit-result", audit });
  }

  if (msg.type === "get-container-info") {
    try {
      const container = await figma.getNodeByIdAsync(msg.containerId);
      if (
        container &&
        (container.type === "SECTION" || container.type === "FRAME")
      ) {
        figma.ui.postMessage({
          type: "container-info",
          id: container.id,
          name: container.name,
          containerType: container.type,
        });
      }
    } catch (error) {
      console.error("Error getting container info:", error);
    }
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
  const containerId = getSelectedContainerId();
  figma.ui.postMessage({ type: "selection-section", sectionId: containerId });
}

// These heavy operations have been removed for performance:
// - Document change listening (was calling figma.loadAllPagesAsync())
// - Sections polling (was running every 2 seconds)
// - Container scanning (was recursively searching all nodes)
//
// We now use lightweight direct selection instead!
