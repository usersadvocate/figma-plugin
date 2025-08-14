// Sections Detector Plugin (base)
figma.showUI(__html__, { width: 500, height: 400 });

// Imports from modules
import { getSections, getSelectedSectionId } from './services/sections';
import type { SectionInfo } from './services/sections';

// Analysis types
interface FrameInfo {
  id: string;
  name: string;
  textNodesCount: number;
  textNodes: {
    id: string;
    name: string;
    characters: string;
  }[];
}

interface SectionAnalysis {
  sectionId: string;
  sectionName: string;
  totalFrames: number;
  totalTextNodes: number;
  frames: FrameInfo[];
}

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-sections') {
    const sections = getSections();
    const selectedSectionId = getSelectedSectionId();
    figma.ui.postMessage({ type: 'sections-loaded', sections, selectedSectionId });
  }
  
  if (msg.type === 'analyze-section') {
    const analysis = await analyzeSectionContent(msg.sectionId);
    figma.ui.postMessage({ type: 'section-analysis', analysis });
  }
  
  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Listen for selection changes and notify UI with the current section
figma.on('selectionchange', () => {
  const sectionId = getSelectedSectionId();
  figma.ui.postMessage({ type: 'selection-section', sectionId });
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
    figma.ui.postMessage({ type: 'sections-loaded', sections, selectedSectionId });
  }, 150);
}

// Refresh sections when current page changes
figma.on('currentpagechange', () => {
  refreshSectionsDebounced();
});

// Try to track document changes (create/delete/rename/move of sections)
function attachDocumentChangeListener() {
  const handler = (evt: any) => {
    const changes = (evt as any).documentChanges as ReadonlyArray<any> | undefined;
    if (!changes || changes.length === 0) return;
    for (const ch of changes) {
      const node = ch.node as BaseNode | undefined;
      if (node && node.type === 'SECTION') {
        refreshSectionsDebounced();
        return;
      }
    }
  };

  try {
    const loadAllPagesAsync = (figma as any).loadAllPagesAsync;
    if (typeof loadAllPagesAsync === 'function') {
      loadAllPagesAsync()
        .then(() => {
          try {
            figma.on('documentchange', handler);
          } catch (e) {
            startSectionsPolling();
          }
        })
        .catch(() => {
          startSectionsPolling();
        });
    } else {
      try {
        figma.on('documentchange', handler);
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

async function analyzeSectionContent(sectionId: string): Promise<SectionAnalysis | null> {
  try {
    console.log('Analyzing section with ID:', sectionId);
    const section = await figma.getNodeByIdAsync(sectionId);
    console.log('Found node:', section && section.type, section && section.name);
    
    if (!section || section.type !== 'SECTION') {
      console.error('Node is not a section:', section && section.type);
      return null;
    }

    const frames: FrameInfo[] = [];
    let totalTextNodes = 0;

    // Find all direct children of the section (not just frames)
    console.log('Section children:', section.children.length);
    const frameChildren = section.children.filter(child => child.type === 'FRAME') as FrameNode[];
    console.log('Frame children found:', frameChildren.length);
    
    for (const frame of frameChildren) {
      console.log('Processing frame:', frame.name);
      // Find all text nodes within this frame
      const textNodes = frame.findAll(node => node.type === 'TEXT') as TextNode[];
      console.log('Text nodes in frame:', textNodes.length);
      
      const frameInfo: FrameInfo = {
        id: frame.id,
        name: frame.name,
        textNodesCount: textNodes.length,
        textNodes: textNodes.map(textNode => ({
          id: textNode.id,
          name: textNode.name,
          characters: textNode.characters ? textNode.characters.substring(0, 50) + (textNode.characters.length > 50 ? '...' : '') : ''
        }))
      };
      
      frames.push(frameInfo);
      totalTextNodes += textNodes.length;
    }

    const result = {
      sectionId: section.id,
      sectionName: section.name,
      totalFrames: frameChildren.length,
      totalTextNodes,
      frames
    };
    
    console.log('Analysis result:', result);
    return result;
  } catch (error) {
    console.error('Error analyzing section:', error);
    return null;
  }
}
