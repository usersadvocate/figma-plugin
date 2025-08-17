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
    hasBoundVariables: boolean;
    boundVariableDetails?: string;
    propertyDetails: string[];
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

// Helper function to resolve variable name and collection
async function getVariableInfo(variableId: string): Promise<string> {
  try {
    console.log('🔍 Resolving variable ID:', variableId);
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    console.log('📦 Variable object:', variable);
    
    if (!variable) {
      console.log('❌ Variable not found for ID:', variableId);
      return `Unknown Variable (${variableId.substring(0, 10)}...)`;
    }
    
    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    console.log('📁 Collection object:', collection);
    const collectionName = collection ? collection.name : 'Unknown Collection';
    
    const result = `${variable.name} (${collectionName})`;
    console.log('✅ Resolved variable info:', result);
    return result;
  } catch (error) {
    console.error('💥 Error resolving variable:', variableId, error);
    return `Error Variable (${variableId.substring(0, 10)}...)`;
  }
}

// Helper function to get text style info
async function getTextStyleInfo(textStyleId: string): Promise<string> {
  try {
    const textStyle = await figma.getStyleByIdAsync(textStyleId);
    if (!textStyle) return 'Unknown Style';
    return textStyle.name;
  } catch (error) {
    console.error('Error resolving text style:', textStyleId, error);
    return 'Unknown Style';
  }
}

// Helper function to check bound variables and text styles for a text node
async function checkTextNodeBoundVariables(textNode: TextNode): Promise<{ hasBoundVariables: boolean; details: string; propertyDetails: string[] }> {
  const boundVars = textNode.boundVariables;
  console.log(`Checking text node "${textNode.name}":`, boundVars);
  console.log(`Text style ID:`, textNode.textStyleId);
  
  const propertyDetails: string[] = [];
  let hasAnyDesignSystemUsage = false;
  
  // Detection Rules:
  // 1. Variables (boundVariables) take precedence
  // 2. Text Style (textStyleId) as one unit for typography
  // 3. Manual is fallback (neither Variables nor Text Style)
  
  // First, check if there's a Text Style applied
  if (textNode.textStyleId && typeof textNode.textStyleId === 'string') {
    const styleName = await getTextStyleInfo(textNode.textStyleId);
    propertyDetails.push(`textStyle: Text Style (${styleName})`);
    hasAnyDesignSystemUsage = true;
  }
  
  // Then check individual property overrides with Variables
  if (boundVars && boundVars.fontSize && Array.isArray(boundVars.fontSize) && boundVars.fontSize.length > 0) {
    const fontSize = boundVars.fontSize[0];
    const varInfo = await getVariableInfo(fontSize.id);
    propertyDetails.push(`fontSize: Variable (${varInfo})`);
    hasAnyDesignSystemUsage = true;
  }
  
  if (boundVars && boundVars.lineHeight && Array.isArray(boundVars.lineHeight) && boundVars.lineHeight.length > 0) {
    const lineHeight = boundVars.lineHeight[0];
    const varInfo = await getVariableInfo(lineHeight.id);
    propertyDetails.push(`lineHeight: Variable (${varInfo})`);
    hasAnyDesignSystemUsage = true;
  }
  
  if (boundVars && boundVars.letterSpacing && Array.isArray(boundVars.letterSpacing) && boundVars.letterSpacing.length > 0) {
    const letterSpacing = boundVars.letterSpacing[0];
    const varInfo = await getVariableInfo(letterSpacing.id);
    propertyDetails.push(`letterSpacing: Variable (${varInfo})`);
    hasAnyDesignSystemUsage = true;
  }
  
  // If no Text Style and no Variables for typography, show Manual
  if (!textNode.textStyleId && 
      (!boundVars || 
       (!boundVars.fontSize || !Array.isArray(boundVars.fontSize) || boundVars.fontSize.length === 0) &&
       (!boundVars.lineHeight || !Array.isArray(boundVars.lineHeight) || boundVars.lineHeight.length === 0) &&
       (!boundVars.letterSpacing || !Array.isArray(boundVars.letterSpacing) || boundVars.letterSpacing.length === 0))) {
    propertyDetails.push(`typography: Manual`);
  }
  
  // Check fills (text color)
  if (boundVars && boundVars.fills && boundVars.fills.length > 0) {
    for (let i = 0; i < boundVars.fills.length; i++) {
      const fillVar = boundVars.fills[i];
      if (fillVar) {
        const varInfo = await getVariableInfo(fillVar.id);
        propertyDetails.push(`fills[${i}]: Variable (${varInfo})`);
        hasAnyDesignSystemUsage = true;
      }
    }
  } else if (textNode.fillStyleId && typeof textNode.fillStyleId === 'string') {
    try {
      const paintStyle = await figma.getStyleByIdAsync(textNode.fillStyleId);
      const styleName = paintStyle ? paintStyle.name : 'Unknown Style';
      propertyDetails.push(`fills: Paint Style (${styleName})`);
      hasAnyDesignSystemUsage = true;
    } catch (error) {
      propertyDetails.push(`fills: Manual`);
    }
  } else {
    propertyDetails.push(`fills: Manual`);
  }
  
  // Check opacity (separate from text style)
  if (boundVars && boundVars.opacity && Array.isArray(boundVars.opacity) && boundVars.opacity.length > 0) {
    const opacity = boundVars.opacity[0];
    const varInfo = await getVariableInfo(opacity.id);
    propertyDetails.push(`opacity: Variable (${varInfo})`);
    hasAnyDesignSystemUsage = true;
  } else {
    propertyDetails.push(`opacity: Manual`);
  }

  return {
    hasBoundVariables: hasAnyDesignSystemUsage,
    details: propertyDetails.join(', '),
    propertyDetails
  };
}



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
        textNodes: await Promise.all(textNodes.map(async (textNode) => {
          const { hasBoundVariables, details, propertyDetails } = await checkTextNodeBoundVariables(textNode);
          return {
            id: textNode.id,
            name: textNode.name,
            characters: textNode.characters ? textNode.characters.substring(0, 50) + (textNode.characters.length > 50 ? '...' : '') : '',
            hasBoundVariables,
            boundVariableDetails: details,
            propertyDetails
          };
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
