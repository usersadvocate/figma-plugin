// Sections Detector Plugin (base)
figma.showUI(__html__, { width: 500, height: 400 });

// Imports from modules
import { getSections, getSelectedSectionId } from "./services/sections";
import type { SectionInfo } from "./services/sections";

// Analysis types
interface NodeInfo {
  id: string;
  name: string;
  type: string;
  characters?: string; // Only for text nodes
  variableBindings: VariableBinding[];
  groupedBindings: GroupedBindings;
  hasBoundVariables: boolean;
  boundVariableDetails?: string;
  propertyDetails: string[];
}

interface FrameInfo {
  id: string;
  name: string;
  totalNodes: number;
  textNodesCount: number;
  nodes: NodeInfo[];
}

interface SectionAnalysis {
  sectionId: string;
  sectionName: string;
  totalFrames: number;
  totalTextNodes: number;
  totalNodes: number;
  frames: FrameInfo[];
}

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
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

  if (msg.type === "cancel") {
    figma.closePlugin();
  }
};

// Listen for selection changes and notify UI with the current section
figma.on("selectionchange", () => {
  const sectionId = getSelectedSectionId();
  figma.ui.postMessage({ type: "selection-section", sectionId });
});

// Debounced broadcaster for sections list
let pendingSectionsRefresh = false;
function refreshSectionsDebounced() {
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
  }, 150);
}

// Refresh sections when current page changes
figma.on("currentpagechange", () => {
  refreshSectionsDebounced();
});

// Try to track document changes (create/delete/rename/move of sections)
function attachDocumentChangeListener() {
  const handler = (evt: any) => {
    const changes = (evt as any).documentChanges as
      | ReadonlyArray<any>
      | undefined;
    if (!changes || changes.length === 0) return;
    for (const ch of changes) {
      const node = ch.node as BaseNode | undefined;
      if (node && node.type === "SECTION") {
        refreshSectionsDebounced();
        return;
      }
    }
  };

  try {
    const loadAllPagesAsync = (figma as any).loadAllPagesAsync;
    if (typeof loadAllPagesAsync === "function") {
      loadAllPagesAsync()
        .then(() => {
          try {
            figma.on("documentchange", handler);
          } catch (e) {
            startSectionsPolling();
          }
        })
        .catch(() => {
          startSectionsPolling();
        });
    } else {
      try {
        figma.on("documentchange", handler);
      } catch (e) {
        startSectionsPolling();
      }
    }
  } catch (e) {
    startSectionsPolling();
  }
}

let pollingTimer: number | null = null;
function startSectionsPolling() {
  if (pollingTimer !== null) return;
  pollingTimer = setInterval(() => {
    refreshSectionsDebounced();
  }, 1000) as unknown as number;
}

attachDocumentChangeListener();

// Define comprehensive design properties grouped by category
const DESIGN_PROPERTY_GROUPS = {
  text: [
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textStyleId",
    "fills", // text color
  ],
  layout: [
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "itemSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ],
  styling: [
    "fills",
    "strokes",
    "strokeWeight",
    "strokeAlign",
    "strokeJoin",
    "strokeMiterLimit",
    "strokeCap",
    "opacity",
    "blendMode",
    "isMask",
  ],
  shape: [
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "cornerSmoothing",
  ],
  effects: [
    "effects",
    // Individual effect properties that can have variable bindings
    "effect.color",
    "effect.offsetX",
    "effect.offsetY",
    "effect.radius",
    "effect.spread",
    "effect.blur",
  ],
  advanced: [
    "rotation",
    "fillStyleId",
    "strokeStyleId",
    "componentProperties",
    "exposedInstances",
  ],
} as const;

type PropertyGroup = keyof typeof DESIGN_PROPERTY_GROUPS;

// Flatten all properties for iteration
const DESIGN_PROPERTIES = Object.values(
  DESIGN_PROPERTY_GROUPS
).flat() as readonly string[];

type DesignProperty = (typeof DESIGN_PROPERTIES)[number];

interface VariableBinding {
  property: DesignProperty;
  propertyGroup: PropertyGroup;
  variableId: string;
  variableName: string;
  collectionName: string;
  bindingType: "single" | "array";
  arrayIndex?: number;
}

// Helper function to get property group for a given property
function getPropertyGroup(property: string): PropertyGroup {
  for (const [group, properties] of Object.entries(DESIGN_PROPERTY_GROUPS)) {
    if ((properties as readonly string[]).includes(property)) {
      return group as PropertyGroup;
    }
  }

  // Handle nested effect properties
  if (property.startsWith("effect.")) {
    return "effects";
  }

  return "advanced"; // fallback
}

// Group bindings by category
interface GroupedBindings {
  text: VariableBinding[];
  layout: VariableBinding[];
  styling: VariableBinding[];
  shape: VariableBinding[];
  effects: VariableBinding[];
  advanced: VariableBinding[];
}

// Helper function to resolve variable name and collection
async function getVariableInfo(
  variableId: string
): Promise<{ name: string; collectionName: string } | null> {
  try {
    console.log("🔍 Resolving variable ID:", variableId);
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    console.log("📦 Variable object:", variable);

    if (!variable) {
      console.log("❌ Variable not found for ID:", variableId);
      return null;
    }

    const collection = await figma.variables.getVariableCollectionByIdAsync(
      variable.variableCollectionId
    );
    console.log("📁 Collection object:", collection);
    const collectionName = collection ? collection.name : "Unknown Collection";

    return {
      name: variable.name,
      collectionName,
    };
  } catch (error) {
    console.error("💥 Error resolving variable:", variableId, error);
    return null;
  }
}

// Universal function to extract variable bindings from any SceneNode
async function extractVariableBindings(
  node: SceneNode
): Promise<VariableBinding[]> {
  const bindings: VariableBinding[] = [];

  try {
    // Get bound variables - try different access patterns
    let boundVars: any = {};

    // Method 1: Direct property access (most common)
    if ("boundVariables" in node) {
      boundVars = (node as any).boundVariables || {};
    }

    // Method 2: Check if it's a container node that might have bound variables
    if (!Object.keys(boundVars).length && "children" in node) {
      // For container nodes, bound variables might be on individual properties
      const containerNode = node as FrameNode | ComponentNode | InstanceNode;
      if (containerNode.boundVariables) {
        boundVars = containerNode.boundVariables;
      }
    }

    console.log(
      `🔍 Checking node "${node.name}" (${node.type}) for bound variables:`,
      JSON.stringify(boundVars, null, 2)
    );

    if (!boundVars || typeof boundVars !== "object") {
      console.log("⚠️ No bound variables found on node");
      return bindings;
    }

    // Special handling for effects - check both array and nested properties
    const effectsBinding = boundVars["effects"];
    if (effectsBinding) {
      console.log(`✨ Found effects binding:`, effectsBinding);

      try {
        if (Array.isArray(effectsBinding)) {
          for (let i = 0; i < effectsBinding.length; i++) {
            const effectBind = effectsBinding[i];
            if (effectBind && effectBind.id) {
              // Overall effect binding
              const varInfo = await getVariableInfo(effectBind.id);
              if (varInfo) {
                bindings.push({
                  property: "effects",
                  propertyGroup: "effects",
                  variableId: effectBind.id,
                  variableName: varInfo.name,
                  collectionName: varInfo.collectionName,
                  bindingType: "array",
                  arrayIndex: i,
                });
              }
            } else if (effectBind && typeof effectBind === "object") {
              // Check for individual effect property bindings
              const effectProperties = [
                "color",
                "offsetX",
                "offsetY",
                "radius",
                "spread",
                "blur",
              ];
              for (const effectProp of effectProperties) {
                const nestedBinding = effectBind[effectProp];
                if (nestedBinding && nestedBinding.id) {
                  const varInfo = await getVariableInfo(nestedBinding.id);
                  if (varInfo) {
                    bindings.push({
                      property: `effect.${effectProp}`,
                      propertyGroup: "effects",
                      variableId: nestedBinding.id,
                      variableName: varInfo.name,
                      collectionName: varInfo.collectionName,
                      bindingType: "array",
                      arrayIndex: i,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("💥 Error processing effects binding:", error);
      }
    }

    // Iterate through all other design properties
    for (const prop of DESIGN_PROPERTIES) {
      if (prop === "effects") continue; // Skip effects as we handled it above

      const binding = boundVars[prop];
      if (!binding) continue;

      console.log(`📌 Found binding for property "${prop}":`, binding);

      try {
        // Handle array bindings (like fills, strokes)
        if (Array.isArray(binding)) {
          for (let i = 0; i < binding.length; i++) {
            const bind = binding[i];
            if (bind && bind.id) {
              const varInfo = await getVariableInfo(bind.id);
              if (varInfo) {
                bindings.push({
                  property: prop,
                  propertyGroup: getPropertyGroup(prop),
                  variableId: bind.id,
                  variableName: varInfo.name,
                  collectionName: varInfo.collectionName,
                  bindingType: "array",
                  arrayIndex: i,
                });
              }
            }
          }
        }
        // Handle single bindings
        else if (binding && binding.id) {
          const varInfo = await getVariableInfo(binding.id);
          if (varInfo) {
            bindings.push({
              property: prop,
              propertyGroup: getPropertyGroup(prop),
              variableId: binding.id,
              variableName: varInfo.name,
              collectionName: varInfo.collectionName,
              bindingType: "single",
            });
          }
        }
      } catch (error) {
        console.error(
          `💥 Error processing binding for property "${prop}":`,
          error
        );
      }
    }

    console.log(
      `✅ Found ${bindings.length} variable bindings for node "${node.name}"`
    );
    return bindings;
  } catch (error) {
    console.error("💥 Error extracting variable bindings:", error);
    return bindings;
  }
}

// Helper function to get text style info
async function getTextStyleInfo(textStyleId: string): Promise<string> {
  try {
    const textStyle = await figma.getStyleByIdAsync(textStyleId);
    if (!textStyle) return "Unknown Style";
    return textStyle.name;
  } catch (error) {
    console.error("Error resolving text style:", textStyleId, error);
    return "Unknown Style";
  }
}

// Helper function to group bindings by category
function groupBindings(bindings: VariableBinding[]): GroupedBindings {
  const grouped: GroupedBindings = {
    text: [],
    layout: [],
    styling: [],
    shape: [],
    effects: [],
    advanced: [],
  };

  for (const binding of bindings) {
    grouped[binding.propertyGroup].push(binding);
  }

  return grouped;
}

// Helper function to analyze any scene node for variable bindings
async function analyzeNode(node: SceneNode): Promise<NodeInfo> {
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

  return nodeInfo;
}

async function analyzeSectionContent(
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

    // Find all direct children of the section (not just frames)
    console.log("Section children:", section.children.length);
    const frameChildren = section.children.filter(
      (child) => child.type === "FRAME"
    ) as FrameNode[];
    console.log("Frame children found:", frameChildren.length);

    for (const frame of frameChildren) {
      console.log("Processing frame:", frame.name);

      // Find all nodes within this frame (not just text nodes)
      const allNodes = frame.findAll() as SceneNode[];
      console.log(`Total nodes in frame: ${allNodes.length}`);

      // Count text nodes
      const textNodes = allNodes.filter((node) => node.type === "TEXT");
      console.log("Text nodes in frame:", textNodes.length);

      const frameInfo: FrameInfo = {
        id: frame.id,
        name: frame.name,
        totalNodes: allNodes.length,
        textNodesCount: textNodes.length,
        nodes: await Promise.all(allNodes.map(analyzeNode)),
      };

      frames.push(frameInfo);
      totalTextNodes += textNodes.length;
      totalNodes += allNodes.length;
    }

    const result = {
      sectionId: section.id,
      sectionName: section.name,
      totalFrames: frameChildren.length,
      totalTextNodes,
      totalNodes,
      frames,
    };

    console.log("Analysis result:", result);
    return result;
  } catch (error) {
    console.error("Error analyzing section:", error);
    return null;
  }
}
