// Sections Detector Plugin (base)
figma.showUI(__html__, { width: 500, height: 400 });

// Imports from modules
import { getSections, getSelectedSectionId } from "./services/sections";
import type { SectionInfo } from "./services/sections";

// Analysis types
interface ComponentInfo {
  id: string;
  name: string;
  mainComponentId: string;
  mainComponentName: string;
  isRemote: boolean;
  remoteLibrary?: string;
}

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
  componentInfo?: ComponentInfo; // Only for INSTANCE nodes
}

interface FrameInfo {
  id: string;
  name: string;
  totalNodes: number;
  textNodesCount: number;
  instanceNodesCount: number;
  componentNodesCount: number;
  remoteComponentsCount: number;
  localComponentsCount: number;
  nodes: NodeInfo[];
}

interface SectionAnalysis {
  sectionId: string;
  sectionName: string;
  totalFrames: number;
  totalTextNodes: number;
  totalNodes: number;
  totalInstanceNodes: number;
  totalComponentNodes: number;
  totalRemoteComponents: number;
  totalLocalComponents: number;
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

  if (msg.type === "jump-to-node") {
    jumpToNode(msg.nodeId);
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
  }

  if (msg.type === "debug-components") {
    debugComponentDetection();
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

// Function to jump to a specific node in Figma
async function jumpToNode(nodeId: string) {
  try {
    console.log(`🔍 Jumping to node: ${nodeId}`);

    // Find the node by ID
    const targetNode = await figma.getNodeByIdAsync(nodeId);

    if (!targetNode) {
      console.error(`❌ Node not found: ${nodeId}`);
      return;
    }

    // Check if it's a scene node (not a page node)
    if (targetNode.type === "PAGE") {
      console.error(`❌ Cannot jump to page nodes: ${nodeId}`);
      return;
    }

    const sceneNode = targetNode as SceneNode;
    console.log(`✅ Found node: ${sceneNode.name} (${sceneNode.type})`);

    // Select the node
    figma.currentPage.selection = [sceneNode];

    // Scroll the node into view with some padding
    if (sceneNode.absoluteBoundingBox) {
      const bounds = sceneNode.absoluteBoundingBox;
      const padding = 50; // Add some padding around the node

      // Calculate the viewport bounds with padding
      const viewportBounds = {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      };

      // Scroll and zoom to fit the node
      figma.viewport.scrollAndZoomIntoView([sceneNode]);

      console.log(`🎯 Jumped to node: ${sceneNode.name}`);
      console.log(`📍 Node bounds:`, bounds);
      console.log(`📏 Viewport adjusted with ${padding}px padding`);
    } else {
      console.log(`⚠️ Node has no bounding box, just selecting it`);
    }

    // Also notify the UI that we've jumped to the node
    figma.ui.postMessage({
      type: "node-jumped",
      nodeId: nodeId,
      nodeName: sceneNode.name,
      nodeType: sceneNode.type,
    });
  } catch (error) {
    console.error(
      `💥 Error jumping to node ${nodeId}:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

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
    // Effect types
    "DROP_SHADOW",
    "INNER_SHADOW",
    "LAYER_BLUR",
    "BACKGROUND_BLUR",
    // Effect style bindings
    "effectStyleId",
    // Effect properties by type
    "dropShadow.color",
    "dropShadow.offsetX",
    "dropShadow.offsetY",
    "dropShadow.radius",
    "dropShadow.spread",
    "innerShadow.color",
    "innerShadow.offsetX",
    "innerShadow.offsetY",
    "innerShadow.radius",
    "innerShadow.spread",
    "layerBlur.radius",
    "backgroundBlur.radius",
    // Generic effect properties (fallback)
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

  // Handle effect-related properties
  if (
    property.startsWith("effect.") ||
    property.startsWith("dropShadow.") ||
    property.startsWith("innerShadow.") ||
    property.startsWith("layerBlur.") ||
    property.startsWith("backgroundBlur.") ||
    property.includes("SHADOW") ||
    property.includes("BLUR")
  ) {
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
      boundVars
    );

    // Method 3: Check for bound variables using getBoundVariableForKey API
    console.log(`🔍 Checking for key-based variable bindings:`);
    const possibleKeys = [
      "effects",
      "dropShadow",
      "innerShadow",
      "layerBlur",
      "backgroundBlur",
      "shadow",
      "effectStyleId",
      "fillStyleId",
      "strokeStyleId",
      "textStyleId",
    ];

    for (const key of possibleKeys) {
      try {
        // Check if this node has the method and try to get bound variable for this key
        if (typeof (node as any).getBoundVariableForKey === "function") {
          const boundVar = (node as any).getBoundVariableForKey(key);
          if (boundVar) {
            console.log(`   🎯 FOUND KEY-BASED BINDING: "${key}" ->`, boundVar);
            // Add this to our boundVars for processing
            if (!boundVars[key]) {
              boundVars[key] = boundVar;
            }
          }
        }
      } catch (error) {
        // Method might not exist or might error, that's okay
        console.log(
          `   ❌ Error checking key "${key}":`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    console.log(
      `📋 Final boundVars keys after key-based check:`,
      Object.keys(boundVars)
    );

    // Method 4: Check for component properties that might contain effects bindings
    if (node.type === "INSTANCE") {
      const instanceNode = node as InstanceNode;
      console.log(`🔍 Checking instance properties for effects:`);

      if (instanceNode.componentProperties) {
        console.log(
          `   Found component properties:`,
          Object.keys(instanceNode.componentProperties)
        );
        for (const [propKey, propValue] of Object.entries(
          instanceNode.componentProperties
        )) {
          if (
            propKey.toLowerCase().includes("shadow") ||
            propKey.toLowerCase().includes("effect")
          ) {
            console.log(
              `   🎯 Found effects-related component property "${propKey}":`,
              propValue
            );
          }

          // Check if component property has bound variables
          if (
            typeof propValue === "object" &&
            propValue !== null &&
            "boundVariables" in propValue
          ) {
            console.log(
              `   📋 Component property "${propKey}" has bound variables:`,
              (propValue as any).boundVariables
            );
          }
        }
      }
    }

    // Debug: Check specifically for effects
    if (boundVars && typeof boundVars === "object") {
      if ("effects" in boundVars) {
        console.log(
          `🎯 Node "${node.name}" has effects binding:`,
          boundVars.effects
        );
      } else {
        console.log(`❌ Node "${node.name}" has NO effects binding`);
      }
    }

    // Debug: Check if node has effects property directly
    const nodeAsAny = node as any;
    if (nodeAsAny.effects && Array.isArray(nodeAsAny.effects)) {
      console.log(
        `🎨 Node "${node.name}" has ${nodeAsAny.effects.length} effects:`
      );
      nodeAsAny.effects.forEach((effect: any, index: number) => {
        console.log(`   Effect ${index}:`, {
          type: effect.type,
          visible: effect.visible,
          color: effect.color,
          offset: effect.offset,
          radius: effect.radius,
          spread: effect.spread,
        });
      });
    } else {
      console.log(`❌ Node "${node.name}" has no effects array`);
    }

    // Debug: Check for shadow-related properties directly on the node
    console.log(`🔍 Checking for shadow properties on "${node.name}":`);
    const shadowProps = [
      "shadow",
      "dropShadow",
      "innerShadow",
      "boxShadow",
      "textShadow",
    ];
    shadowProps.forEach((prop) => {
      if (nodeAsAny[prop]) {
        console.log(`   🎯 Found ${prop}:`, nodeAsAny[prop]);
      }
    });

    // Debug: Check for any property that contains "shadow" or "effect"
    console.log(
      `🔍 Checking all node properties for shadow/effect-related keys:`
    );
    Object.keys(nodeAsAny).forEach((key) => {
      if (
        key.toLowerCase().includes("shadow") ||
        key.toLowerCase().includes("effect")
      ) {
        console.log(`   🎯 Found property "${key}":`, nodeAsAny[key]);
      }
    });

    // Debug: Check if there are any variables that contain "shadow" in their name
    console.log(`🔍 Looking for variables with "shadow" in the name:`);
    try {
      const allVariables = await figma.variables.getLocalVariablesAsync();
      const shadowVars = allVariables.filter((v) =>
        v.name.toLowerCase().includes("shadow")
      );
      if (shadowVars.length > 0) {
        console.log(
          `   🎯 Found ${shadowVars.length} shadow-related variables:`
        );
        shadowVars.forEach((v) => {
          console.log(`      - "${v.name}" (${v.id})`);
        });
      } else {
        console.log(`   ❌ No shadow-related variables found`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking variables:`, error);
    }

    if (!boundVars || typeof boundVars !== "object") {
      console.log("⚠️ No bound variables found on node");
      return bindings;
    }

    // Special handling for effects - check both array and nested properties
    const effectsBinding = boundVars["effects"];
    if (effectsBinding) {
      console.log(
        `✨ Found effects binding:`,
        JSON.stringify(effectsBinding, null, 2)
      );

      // Check if this is a key-based binding (single variable reference)
      if (
        effectsBinding &&
        effectsBinding.id &&
        !Array.isArray(effectsBinding)
      ) {
        console.log(
          `🎯 Effects bound via setBoundVariableForKey! Processing single binding...`
        );
        try {
          const varInfo = await getVariableInfo(effectsBinding.id);
          if (varInfo) {
            bindings.push({
              property: "effects",
              propertyGroup: "effects",
              variableId: effectsBinding.id,
              variableName: varInfo.name,
              collectionName: varInfo.collectionName,
              bindingType: "single",
            });
            console.log(
              `🎨 KEY-BASED EFFECTS VARIABLE DETECTED: "${varInfo.name}"!`
            );
          }
        } catch (error) {
          console.error(
            "💥 Error processing key-based effects binding:",
            error
          );
        }
      }

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
              // Check effect type and handle accordingly
              const effectType = effectBind.type;

              if (
                effectType === "DROP_SHADOW" ||
                effectType === "INNER_SHADOW"
              ) {
                // Shadow effects have: color, offsetX, offsetY, radius, spread
                const shadowPrefix =
                  effectType === "DROP_SHADOW" ? "dropShadow" : "innerShadow";
                const shadowProperties = [
                  "color",
                  "offsetX",
                  "offsetY",
                  "radius",
                  "spread",
                ];

                for (const prop of shadowProperties) {
                  const nestedBinding = effectBind[prop];
                  if (nestedBinding && nestedBinding.id) {
                    const varInfo = await getVariableInfo(nestedBinding.id);
                    if (varInfo) {
                      bindings.push({
                        property: `${shadowPrefix}.${prop}`,
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
              } else if (
                effectType === "LAYER_BLUR" ||
                effectType === "BACKGROUND_BLUR"
              ) {
                // Blur effects have: radius
                const blurPrefix =
                  effectType === "LAYER_BLUR" ? "layerBlur" : "backgroundBlur";
                const radiusBinding = effectBind.radius;

                if (radiusBinding && radiusBinding.id) {
                  const varInfo = await getVariableInfo(radiusBinding.id);
                  if (varInfo) {
                    bindings.push({
                      property: `${blurPrefix}.radius`,
                      propertyGroup: "effects",
                      variableId: radiusBinding.id,
                      variableName: varInfo.name,
                      collectionName: varInfo.collectionName,
                      bindingType: "array",
                      arrayIndex: i,
                    });
                  }
                }
              } else {
                // Fallback for unknown effect types - check common properties
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
        }
      } catch (error) {
        console.error("💥 Error processing effects binding:", error);
      }
    }

    // Debug: Check for style-related bindings that might contain shadow info
    console.log(`🔍 Checking for style-related bindings on "${node.name}":`);
    const styleProps = [
      "fillStyleId",
      "strokeStyleId",
      "textStyleId",
      "effectStyleId",
    ];
    styleProps.forEach((prop) => {
      if (boundVars[prop]) {
        console.log(`   🎯 Found style binding "${prop}":`, boundVars[prop]);
        // Check if this style has variable bindings
        if (Array.isArray(boundVars[prop])) {
          boundVars[prop].forEach((binding: any, index: number) => {
            if (binding && binding.id) {
              console.log(
                `      📋 ${prop}[${index}] bound to variable:`,
                binding.id
              );
            }
          });
        } else if (boundVars[prop] && boundVars[prop].id) {
          console.log(
            `      📋 ${prop} bound to variable:`,
            boundVars[prop].id
          );
        }
      }
    });

    // Debug: Look for any boundVars keys that contain "shadow"
    Object.keys(boundVars).forEach((key) => {
      if (key.toLowerCase().includes("shadow")) {
        console.log(
          `   🎯 Found shadow-related boundVar "${key}":`,
          boundVars[key]
        );
      }
    });

    // Special handling for effectStyleId
    const effectStyleBinding = boundVars["effectStyleId"];
    if (effectStyleBinding) {
      console.log(`🎨 Found effectStyleId binding:`, effectStyleBinding);

      try {
        // Handle effectStyleId bindings (can be single or array)
        if (Array.isArray(effectStyleBinding)) {
          for (let i = 0; i < effectStyleBinding.length; i++) {
            const bind = effectStyleBinding[i];
            if (bind && bind.id) {
              const varInfo = await getVariableInfo(bind.id);
              if (varInfo) {
                bindings.push({
                  property: "effectStyleId",
                  propertyGroup: "effects",
                  variableId: bind.id,
                  variableName: varInfo.name,
                  collectionName: varInfo.collectionName,
                  bindingType: "array",
                  arrayIndex: i,
                });
                console.log(
                  `🎨 EFFECT STYLE VARIABLE DETECTED: "${varInfo.name}" bound to effectStyleId!`
                );
              }
            }
          }
        } else if (effectStyleBinding && effectStyleBinding.id) {
          const varInfo = await getVariableInfo(effectStyleBinding.id);
          if (varInfo) {
            bindings.push({
              property: "effectStyleId",
              propertyGroup: "effects",
              variableId: effectStyleBinding.id,
              variableName: varInfo.name,
              collectionName: varInfo.collectionName,
              bindingType: "single",
            });
            console.log(
              `🎨 EFFECT STYLE VARIABLE DETECTED: "${varInfo.name}" bound to effectStyleId!`
            );
          }
        }
      } catch (error) {
        console.error("💥 Error processing effectStyleId binding:", error);
      }
    }

    // Iterate through all other design properties
    for (const prop of DESIGN_PROPERTIES) {
      if (prop === "effects" || prop === "effectStyleId") continue; // Skip effects and effectStyleId as we handled them above

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

    // Summary of what was found
    if (bindings.length > 0) {
      const effectsCount = bindings.filter(
        (b) => b.propertyGroup === "effects"
      ).length;
      if (effectsCount > 0) {
        console.log(
          `🎨 EFFECTS DETECTED: ${effectsCount} effects variables found on "${node.name}"!`
        );
        console.log(
          `📋 Effects bindings:`,
          bindings.filter((b) => b.propertyGroup === "effects")
        );
      }
    }

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

// Helper function to analyze component information for instance nodes
async function analyzeComponentInfo(
  node: InstanceNode
): Promise<ComponentInfo | undefined> {
  try {
    // Use async method for dynamic-page document access
    const mainComponent = await node.getMainComponentAsync();

    if (!mainComponent) {
      console.log(`❌ Instance "${node.name}" has no main component`);
      return undefined;
    }

    const isRemote = mainComponent.remote;

    console.log(`🔍 Analyzing component instance: "${node.name}"`);
    console.log(
      `   Main component: "${mainComponent.name}" (${mainComponent.id})`
    );
    console.log(`   Is remote: ${isRemote}`);

    let remoteLibrary: string | undefined;
    if (isRemote) {
      // For now, we'll just mark it as remote without specific library name
      // The library name detection could be added later if the API becomes available
      remoteLibrary = "Remote Library";
      console.log(`   Remote library: ${remoteLibrary}`);
    }

    return {
      id: node.id,
      name: node.name,
      mainComponentId: mainComponent.id,
      mainComponentName: mainComponent.name,
      isRemote,
      remoteLibrary,
    };
  } catch (error) {
    console.error(
      `💥 Error analyzing component info for "${node.name}":`,
      error
    );
    return undefined;
  }
}

// Helper function to analyze main component definitions
async function analyzeMainComponentInfo(
  node: ComponentNode
): Promise<ComponentInfo | undefined> {
  try {
    const isRemote = node.remote;

    console.log(`🔍 Analyzing main component definition: "${node.name}"`);
    console.log(`   Is remote: ${isRemote}`);

    let remoteLibrary: string | undefined;
    if (isRemote) {
      // For main components, we can also check if they're remote
      remoteLibrary = "Remote Library";
      console.log(`   Remote library: ${remoteLibrary}`);
    }

    return {
      id: node.id,
      name: node.name,
      mainComponentId: node.id, // For main components, the mainComponent is itself
      mainComponentName: node.name,
      isRemote,
      remoteLibrary,
    };
  } catch (error) {
    console.error(
      `💥 Error analyzing main component info for "${node.name}":`,
      error
    );
    return undefined;
  }
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
        // if ('locked' in node && node.locked === true) return false;

        // Check if any parent containers are hidden
        let current = node.parent;
        while (current && current.type !== "PAGE") {
          if ("visible" in current && current.visible === false) return false;
          current = current.parent;
        }

        return true;
      });

      // Count text nodes, instance nodes, and component nodes (only visible ones)
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

      // Analyze all nodes to get component information
      const analyzedNodes = await Promise.all(visibleNodes.map(analyzeNode));

      // Count remote vs local components
      let remoteComponentsCount = 0;
      let localComponentsCount = 0;

      for (const node of analyzedNodes) {
        if (node.componentInfo) {
          if (node.componentInfo.isRemote) {
            remoteComponentsCount++;
          } else {
            localComponentsCount++;
          }
        }
      }

      console.log(
        `Frame "${frame.name}" component analysis: ${remoteComponentsCount} remote, ${localComponentsCount} local`
      );

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
      totalTextNodes += textNodes.length;
      totalNodes += visibleNodes.length;
      totalInstanceNodes += instanceNodes.length;
      totalComponentNodes += componentNodes.length;
      totalRemoteComponents += remoteComponentsCount;
      totalLocalComponents += localComponentsCount;
    }

    const result: SectionAnalysis = {
      sectionId: section.id,
      sectionName: section.name,
      totalFrames: frameChildren.length,
      totalTextNodes,
      totalNodes,
      totalInstanceNodes,
      totalComponentNodes,
      totalRemoteComponents,
      totalLocalComponents,
      frames,
    };

    console.log("Analysis result:", result);
    console.log(`📊 COMPONENT SUMMARY:`);
    console.log(`   Total instances: ${totalInstanceNodes}`);
    console.log(`   Total component definitions: ${totalComponentNodes}`);
    console.log(`   Remote components: ${totalRemoteComponents}`);
    console.log(`   Local components: ${totalLocalComponents}`);

    return result;
  } catch (error) {
    console.error("Error analyzing section:", error);
    return null;
  }
}

// Debug function to help troubleshoot component detection
async function debugComponentDetection() {
  console.log("🔍 DEBUGGING COMPONENT DETECTION");

  try {
    // Get current page
    const currentPage = figma.currentPage;
    console.log(`📄 Current page: "${currentPage.name}"`);

    // Find all nodes on the current page
    const allNodes = currentPage.findAll() as SceneNode[];
    console.log(`🔍 Found ${allNodes.length} total nodes on page`);

    // Filter for component-related nodes
    const instanceNodes = allNodes.filter((node) => node.type === "INSTANCE");
    const componentNodes = allNodes.filter((node) => node.type === "COMPONENT");

    console.log(`🔗 Found ${instanceNodes.length} instance nodes:`);
    for (let i = 0; i < instanceNodes.length; i++) {
      const node = instanceNodes[i];
      console.log(`   ${i + 1}. "${node.name}" (ID: ${node.id})`);
      if (node.type === "INSTANCE") {
        const instance = node as InstanceNode;
        try {
          const mainComponent = await instance.getMainComponentAsync();
          if (mainComponent) {
            console.log(
              `      → Main component: "${mainComponent.name}" (Remote: ${mainComponent.remote})`
            );
          } else {
            console.log(`      → No main component found!`);
          }
        } catch (error) {
          console.log(`      → Error getting main component:`, error);
        }
      }
    }

    console.log(
      `🧩 Found ${componentNodes.length} component definition nodes:`
    );
    componentNodes.forEach((node, i) => {
      console.log(`   ${i + 1}. "${node.name}" (ID: ${node.id})`);
      if (node.type === "COMPONENT") {
        const component = node as ComponentNode;
        console.log(`      → Remote: ${component.remote}`);
      }
    });

    // Check if there are any sections
    const sections = currentPage.children.filter(
      (child) => child.type === "SECTION"
    );
    console.log(`📁 Found ${sections.length} sections:`);
    sections.forEach((section, i) => {
      console.log(`   ${i + 1}. "${section.name}" (ID: ${section.id})`);
    });

    figma.ui.postMessage({
      type: "debug-result",
      message: `Found ${instanceNodes.length} instances and ${componentNodes.length} component definitions`,
    });
  } catch (error) {
    console.error("💥 Error in debug function:", error);
    figma.ui.postMessage({
      type: "debug-result",
      message: `Error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}
