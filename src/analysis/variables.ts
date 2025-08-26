// Variable bindings analysis module

import {
  VariableBinding,
  GroupedBindings,
  PropertyGroup,
  DESIGN_PROPERTY_GROUPS,
  DESIGN_PROPERTIES,
} from "../types";

// Helper function to get property group classification
export function getPropertyGroup(property: string): PropertyGroup {
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

  return "other";
}

// Helper function to resolve variable name and collection
export async function getVariableInfo(
  variableId: string
): Promise<{ name: string; collectionName: string } | null> {
  try {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) return null;

    const collection = await figma.variables.getVariableCollectionByIdAsync(
      variable.variableCollectionId
    );
    const collectionName = collection ? collection.name : "Unknown Collection";

    return {
      name: variable.name,
      collectionName,
    };
  } catch (error) {
    console.error("Error resolving variable:", variableId, error);
    return null;
  }
}

// Extract variable bindings from any SceneNode
export async function extractVariableBindings(
  node: SceneNode
): Promise<VariableBinding[]> {
  const bindings: VariableBinding[] = [];

  try {
    let boundVars: any = {};

    if ("boundVariables" in node) {
      boundVars = (node as any).boundVariables || {};
    }

    if (!boundVars || typeof boundVars !== "object") {
      return bindings;
    }

    // Process all design properties
    for (const prop of DESIGN_PROPERTIES) {
      const binding = boundVars[prop];
      if (!binding) continue;

      try {
        if (Array.isArray(binding)) {
          for (let i = 0; i < binding.length; i++) {
            const bind = binding[i];
            if (bind && bind.id) {
              const varInfo = await getVariableInfo(bind.id);
              if (varInfo) {
                bindings.push({
                  property: prop,
                  variableName: varInfo.name,
                  collectionName: varInfo.collectionName,
                  bindingType: "array",
                  arrayIndex: i,
                  variableType: "design",
                  isAlias: false,
                });
              }
            }
          }
        } else if (binding && binding.id) {
          const varInfo = await getVariableInfo(binding.id);
          if (varInfo) {
            bindings.push({
              property: prop,
              variableName: varInfo.name,
              collectionName: varInfo.collectionName,
              bindingType: "normal",
              variableType: "design",
              isAlias: false,
            });
          }
        }
      } catch (error) {
        console.error(
          `Error processing binding for property "${prop}":`,
          error
        );
      }
    }

    return bindings;
  } catch (error) {
    console.error("Error extracting variable bindings:", error);
    return bindings;
  }
}

// Group bindings by category
export function groupBindings(bindings: VariableBinding[]): GroupedBindings {
  const grouped: GroupedBindings = {
    colors: [],
    spacing: [],
    sizing: [],
    typography: [],
    effects: [],
    other: [],
  };

  for (const binding of bindings) {
    const group = getPropertyGroup(binding.property);
    grouped[group].push(binding);
  }

  return grouped;
}
