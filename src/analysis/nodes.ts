// Node analysis functionality

import { NodeInfo, SectionAnalysis, FrameInfo } from "../types";
import { extractVariableBindings, groupBindings } from "./variables";
import { analyzeComponentInfo, analyzeMainComponentInfo } from "./components";

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

// Main section analysis function
export async function analyzeSectionContent(
  sectionId: string
): Promise<SectionAnalysis | null> {
  try {
    console.log("Analyzing section with ID:", sectionId);
    const section = await figma.getNodeByIdAsync(sectionId);
    console.log(
      "Found node:",
      section && section.type,
      section && section.name
    );

    if (!section || section.type !== "SECTION") {
      console.error("Node is not a section:", section && section.type);
      return null;
    }

    const frames: FrameInfo[] = [];
    let totalTextNodes = 0;
    let totalNodes = 0;
    let totalInstanceNodes = 0;
    let totalComponentNodes = 0;
    let totalRemoteComponents = 0;
    let totalLocalComponents = 0;

    // Find all direct children of the section (not just frames)
    console.log("Section children:", section.children.length);

    // Debug: Log all children types in the section
    section.children.forEach((child, i) => {
      console.log(`   Child ${i + 1}: "${child.name}" (${child.type})`);
    });

    const frameChildren = section.children.filter(
      (child) => child.type === "FRAME"
    ) as FrameNode[];
    console.log("Frame children found:", frameChildren.length);

    for (const frame of frameChildren) {
      console.log("Processing frame:", frame.name);

      // Find all nodes within this frame, excluding hidden layers
      const allNodes = frame.findAll() as SceneNode[];
      const visibleNodes = allNodes.filter((node) => {
        // Exclude hidden layers (eye icon toggled off in layer panel)
        if ("visible" in node && node.visible === false) return false;

        // Exclude locked layers if requested (they might still be visible but locked)
        // Uncomment the line below if you want to exclude locked layers too:
        // if ("locked" in node && node.locked === true) return false;

        return true;
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
      sectionId: section.id,
      sectionName: section.name,
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
    console.error("Error analyzing section:", error);
    return null;
  }
}
