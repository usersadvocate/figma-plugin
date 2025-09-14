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
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 3000);
    });

    const variable = await Promise.race([
      figma.variables.getVariableByIdAsync(variableId),
      timeoutPromise,
    ]);

    if (!variable) return null;

    const collection = await Promise.race([
      figma.variables.getVariableCollectionByIdAsync(
        variable.variableCollectionId
      ),
      timeoutPromise,
    ]);

    const collectionName = collection ? collection.name : "Unknown Collection";

    return {
      name: variable.name,
      collectionName,
    };
  } catch (error) {
    console.warn("Variable lookup failed:", variableId.slice(-8));
    return null;
  }
}

// Extract variable bindings from any SceneNode
export async function extractVariableBindings(
  node: SceneNode
): Promise<VariableBinding[]> {
  const bindings: VariableBinding[] = [];

  try {
    let boundVars: Record<string, unknown> = {};

    if ("boundVariables" in node) {
      boundVars =
        (node as SceneNode & { boundVariables?: Record<string, unknown> })
          .boundVariables || {};
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
              bindings.push({
                property: prop,
                variableId: bind.id,
                variableName:
                  varInfo?.name || `[Variable ID: ${bind.id.slice(-8)}]`,
                collectionName: varInfo?.collectionName || "Unknown Collection",
                bindingType: "array",
                arrayIndex: i,
                variableType: "design",
                isAlias: false,
              });
            }
          }
        } else if (
          binding &&
          typeof binding === "object" &&
          "id" in binding &&
          typeof binding.id === "string"
        ) {
          const varInfo = await getVariableInfo(binding.id);
          bindings.push({
            property: prop,
            variableId: binding.id,
            variableName:
              varInfo?.name || `[Variable ID: ${binding.id.slice(-8)}]`,
            collectionName: varInfo?.collectionName || "Unknown Collection",
            bindingType: "normal",
            variableType: "design",
            isAlias: false,
          });
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
