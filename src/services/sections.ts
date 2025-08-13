export interface SectionInfo {
  id: string;
  name: string;
}

export function getSections(): SectionInfo[] {
  const sections: SectionInfo[] = [];
  figma.currentPage.children.forEach((node) => {
    if (node.type === 'SECTION') {
      sections.push({ id: node.id, name: node.name });
    }
  });
  return sections;
}

export function findAncestorSection(node: BaseNode | null): SectionNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'SECTION') return current as SectionNode;
    current = current.parent;
  }
  return null;
}

export function getSelectedSectionId(): string | null {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) return null;
  for (const node of selection) {
    if (node.type === 'SECTION') return node.id;
  }
  const ancestor = findAncestorSection(selection[0]);
  return ancestor ? ancestor.id : null;
}


