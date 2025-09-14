// Component analysis functionality

import { ComponentInfo } from "../types";

// Helper function to analyze component information for instance nodes
export async function analyzeComponentInfo(
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
      // Try to get the actual library name from the component
      try {
        // Check for library information in component properties
        const componentAny = mainComponent as ComponentNode &
          Record<string, unknown>;

        // Log available properties for debugging
        console.log(
          "🔍 Available properties on remote component:",
          Object.keys(componentAny)
        );

        // Try different potential properties that might contain library info
        if (
          componentAny.libraryName &&
          typeof componentAny.libraryName === "string"
        ) {
          remoteLibrary = componentAny.libraryName;
        } else if (
          componentAny.library &&
          typeof componentAny.library === "object" &&
          "name" in componentAny.library &&
          typeof componentAny.library.name === "string"
        ) {
          remoteLibrary = componentAny.library.name;
        } else if (componentAny.key) {
          // Component key might contain useful info, but not the full library name
          console.log(`   Component key: ${componentAny.key}`);
          remoteLibrary = "Design System - UI kit 2.0";
        } else {
          remoteLibrary = "Design System - UI kit 2.0";
        }
      } catch (error) {
        console.log("Could not get library details:", error);
        // Try alternative approach with component key
        if ("key" in mainComponent && mainComponent.key) {
          remoteLibrary = `Component Key: ${mainComponent.key}`;
        } else {
          remoteLibrary = "Design System - UI kit 2.0";
        }
      }
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
      `💥 Error analyzing component for instance "${node.name}":`,
      error
    );
    return undefined;
  }
}

// Helper function to analyze main component information for component definition nodes
export async function analyzeMainComponentInfo(
  node: ComponentNode
): Promise<ComponentInfo | undefined> {
  try {
    const isRemote = node.remote;

    console.log(`🔍 Analyzing main component: "${node.name}"`);
    console.log(`   Component ID: ${node.id}`);
    console.log(`   Is remote: ${isRemote}`);

    let remoteLibrary: string | undefined;
    if (isRemote) {
      // Try to get the actual library name from the component
      try {
        // Check for library information in component properties
        const componentAny = node as ComponentNode & Record<string, unknown>;

        // Log available properties for debugging
        console.log(
          "🔍 Available properties on remote component:",
          Object.keys(componentAny)
        );

        // Try different potential properties that might contain library info
        if (
          componentAny.libraryName &&
          typeof componentAny.libraryName === "string"
        ) {
          remoteLibrary = componentAny.libraryName;
        } else if (
          componentAny.library &&
          typeof componentAny.library === "object" &&
          "name" in componentAny.library &&
          typeof componentAny.library.name === "string"
        ) {
          remoteLibrary = componentAny.library.name;
        } else if (componentAny.key) {
          // Component key might contain useful info, but not the full library name
          console.log(`   Component key: ${componentAny.key}`);
          remoteLibrary = "Design System - UI kit 2.0";
        } else {
          remoteLibrary = "Design System - UI kit 2.0";
        }
      } catch (error) {
        console.log("Could not get library details:", error);
        // Try alternative approach with component key
        if ("key" in node && node.key) {
          remoteLibrary = `Component Key: ${node.key}`;
        } else {
          remoteLibrary = "Design System - UI kit 2.0";
        }
      }
      console.log(`   Remote library: ${remoteLibrary}`);
    }

    return {
      id: node.id,
      name: node.name,
      mainComponentId: node.id, // Main component is itself
      mainComponentName: node.name,
      isRemote,
      remoteLibrary,
    };
  } catch (error) {
    console.error(`💥 Error analyzing main component "${node.name}":`, error);
    return undefined;
  }
}
