export interface ContainerInfo {
  id: string;
  name: string;
  type: "SECTION" | "FRAME";
}

// Heavy container scanning functions removed for performance.
// We now use lightweight direct selection instead of scanning all nodes.

export function findAncestorSection(node: BaseNode | null): SectionNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === "SECTION") return current as SectionNode;
    current = current.parent;
  }
  return null;
}

export function getSelectedContainerId(): string | null {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) return null;

  for (const node of selection) {
    if (node.type === "SECTION" || node.type === "FRAME") return node.id;
  }

  // Look for ancestor section or frame
  let current: BaseNode | null = selection[0];
  while (current) {
    if (current.type === "SECTION" || current.type === "FRAME")
      return current.id;
    current = current.parent;
  }

  return null;
}

// Keep legacy function for backward compatibility
export function getSelectedSectionId(): string | null {
  return getSelectedContainerId();
}
