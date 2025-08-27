// Node analysis functionality

import { NodeInfo, SectionAnalysis, FrameInfo } from "../types";
import { extractVariableBindings, groupBindings } from "./variables";
import { analyzeComponentInfo, analyzeMainComponentInfo } from "./components";

// Helper function to check if a node is effectively visible (not hidden by itself or parents)
function isNodeEffectivelyVisible(
  node: SceneNode,
  rootFrame?: FrameNode
): boolean {
  // Check if this node is directly hidden
  if ("visible" in node && node.visible === false) {
    return false;
  }

  // Check if any parent in the hierarchy is hidden (up to the root frame)
  let parent = node.parent;
  while (parent && parent !== rootFrame) {
    if ("visible" in parent && parent.visible === false) {
      return false;
    }
    parent = parent.parent;
  }

  return true;
}

// Helper function to analyze any scene node for variable bindings
export async function analyzeNode(node: SceneNode): Promise<NodeInfo> {
  const variableBindings = await extractVariableBindings(node);
  const hasBoundVariables = variableBindings.length > 0;
  const groupedBindings = groupBindings(variableBindings);

  // Create property details for display
  const propertyDetails: string[] = [];

  if (variableBindings.length > 0) {
    for (const binding of variableBindings) {
      const propertyName =
        binding.bindingType === "array"
          ? `${binding.property}[${binding.arrayIndex}]`
          : binding.property;
      propertyDetails.push(
        `${propertyName}: Variable (${binding.variableName} from ${binding.collectionName})`
      );
    }
  } else {
    propertyDetails.push("No variable bindings found");
  }

  const nodeInfo: NodeInfo = {
    id: node.id,
    name: node.name,
    type: node.type,
    variableBindings,
    groupedBindings,
    hasBoundVariables,
    boundVariableDetails: propertyDetails.join(", "),
    propertyDetails,
  };

  // Add text content for text nodes
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    nodeInfo.characters = textNode.characters
      ? textNode.characters.substring(0, 50) +
        (textNode.characters.length > 50 ? "..." : "")
      : "";
  }

  // Add component information for instance nodes and main component definitions
  if (node.type === "INSTANCE") {
    const instanceNode = node as InstanceNode;
    nodeInfo.componentInfo = await analyzeComponentInfo(instanceNode);
  } else if (node.type === "COMPONENT") {
    const componentNode = node as ComponentNode;
    nodeInfo.componentInfo = await analyzeMainComponentInfo(componentNode);
  }

  return nodeInfo;
}

// Main container analysis function (works for both sections and frames)
export async function analyzeContainerContent(
  containerId: string
): Promise<SectionAnalysis | null> {
  try {
    console.log("Analyzing container with ID:", containerId);
    const container = await figma.getNodeByIdAsync(containerId);
    console.log(
      "Found node:",
      container && container.type,
      container && container.name
    );

    if (
      !container ||
      (container.type !== "SECTION" && container.type !== "FRAME")
    ) {
      console.error(
        "Node is not a section or frame:",
        container && container.type
      );
      return null;
    }

    const frames: FrameInfo[] = [];
    let totalTextNodes = 0;
    let totalNodes = 0;
    let totalInstanceNodes = 0;
    let totalComponentNodes = 0;
    let totalRemoteComponents = 0;
    let totalLocalComponents = 0;

    let frameChildren: FrameNode[] = [];

    if (container.type === "SECTION") {
      // For sections, analyze child frames
      console.log("Section children:", container.children.length);

      // Debug: Log all children types in the section
      container.children.forEach((child, i) => {
        console.log(`   Child ${i + 1}: "${child.name}" (${child.type})`);
      });

      frameChildren = container.children.filter(
        (child) => child.type === "FRAME"
      ) as FrameNode[];
      console.log("Frame children found:", frameChildren.length);
    } else if (container.type === "FRAME") {
      // For frames, analyze the frame itself
      frameChildren = [container as FrameNode];
      console.log("Analyzing single frame:", container.name);
    }

    for (const frame of frameChildren) {
      console.log("Processing frame:", frame.name);

      // Find all nodes within this frame, excluding hidden layers
      const allNodes = frame.findAll() as SceneNode[];
      const visibleNodes = allNodes.filter((node) => {
        const isVisible = isNodeEffectivelyVisible(node, frame);
        if (!isVisible) {
          console.log(
            `🙈 Excluding hidden node: "${node.name}" (${node.type})`
          );
          return false;
        }

        // Check if this node is nested inside a COMPONENT that has variable bindings
        let parent = node.parent;
        while (parent && parent !== frame) {
          if (parent.type === "COMPONENT" || parent.type === "INSTANCE") {
            // Check if this component has variable bindings
            const componentHasBindings =
              "boundVariables" in parent &&
              parent.boundVariables &&
              Object.keys(parent.boundVariables).length > 0;

            if (componentHasBindings) {
              console.log(
                `📦 Excluding nested element "${
                  node.name
                }" - parent ${parent.type.toLowerCase()} "${
                  parent.name
                }" has variable bindings`
              );
              return false;
            }
          }
          parent = parent.parent;
        }

        return isVisible;
      });

      const textNodes = visibleNodes.filter((node) => node.type === "TEXT");
      const instanceNodes = visibleNodes.filter(
        (node) => node.type === "INSTANCE"
      );
      const componentNodes = visibleNodes.filter(
        (node) => node.type === "COMPONENT"
      );

      console.log(
        `Processing frame "${frame.name}": ${visibleNodes.length} nodes, ${textNodes.length} text nodes, ${instanceNodes.length} instance nodes, ${componentNodes.length} component nodes`
      );

      // Debug: Log all component and instance names
      if (instanceNodes.length > 0 || componentNodes.length > 0) {
        console.log(`🔍 Found components in frame "${frame.name}":`);
        instanceNodes.forEach((node, i) => {
          console.log(`   Instance ${i + 1}: "${node.name}"`);
        });
        componentNodes.forEach((node, i) => {
          console.log(`   Component ${i + 1}: "${node.name}"`);
        });
      }

      // Count remote vs local components
      let remoteComponentsCount = 0;
      let localComponentsCount = 0;

      // Check instance nodes for remote components
      for (const instanceNode of instanceNodes) {
        try {
          const instance = instanceNode as InstanceNode;
          const mainComponent = await instance.getMainComponentAsync();
          if (mainComponent) {
            if (mainComponent.remote) {
              remoteComponentsCount++;
            } else {
              localComponentsCount++;
            }
          }
        } catch (error) {
          console.error("Error checking instance component:", error);
        }
      }

      // Check component definition nodes
      for (const componentNode of componentNodes) {
        try {
          const component = componentNode as ComponentNode;
          if (component.remote) {
            remoteComponentsCount++;
          } else {
            localComponentsCount++;
          }
        } catch (error) {
          console.error("Error checking component:", error);
        }
      }

      // Analyze all nodes in this frame for variable bindings
      const analyzedNodes: NodeInfo[] = [];
      for (const node of visibleNodes) {
        const nodeInfo = await analyzeNode(node);
        analyzedNodes.push(nodeInfo);
      }

      const frameInfo: FrameInfo = {
        id: frame.id,
        name: frame.name,
        totalNodes: visibleNodes.length,
        textNodesCount: textNodes.length,
        instanceNodesCount: instanceNodes.length,
        componentNodesCount: componentNodes.length,
        remoteComponentsCount,
        localComponentsCount,
        nodes: analyzedNodes,
      };

      frames.push(frameInfo);

      // Update totals
      totalTextNodes += textNodes.length;
      totalNodes += visibleNodes.length;
      totalInstanceNodes += instanceNodes.length;
      totalComponentNodes += componentNodes.length;
      totalRemoteComponents += remoteComponentsCount;
      totalLocalComponents += localComponentsCount;
    }

    const analysis: SectionAnalysis = {
      sectionId: container.id,
      sectionName: container.name,
      totalFrames: frames.length,
      totalTextNodes,
      totalNodes,
      totalInstanceNodes,
      totalComponentNodes,
      totalRemoteComponents,
      totalLocalComponents,
      frames,
    };

    console.log("Analysis complete:", {
      frames: analysis.totalFrames,
      nodes: analysis.totalNodes,
      textNodes: analysis.totalTextNodes,
      instances: analysis.totalInstanceNodes,
      components: analysis.totalComponentNodes,
      remoteComponents: analysis.totalRemoteComponents,
      localComponents: analysis.totalLocalComponents,
    });

    return analysis;
  } catch (error) {
    console.error("Error analyzing container:", error);
    return null;
  }
}

// Legacy function for backward compatibility
export async function analyzeSectionContent(
  sectionId: string
): Promise<SectionAnalysis | null> {
  return analyzeContainerContent(sectionId);
}
