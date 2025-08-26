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
      // For now, we'll just mark it as remote without specific library name
      remoteLibrary = "Remote Library";
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
