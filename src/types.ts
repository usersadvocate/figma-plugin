// Analysis types for the Figma plugin

export interface ComponentInfo {
  id: string;
  name: string;
  mainComponentId: string;
  mainComponentName: string;
  isRemote: boolean;
  remoteLibrary?: string;
}

export interface NodeInfo {
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

export interface FrameInfo {
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

export interface SectionAnalysis {
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

// Variable binding types
export type PropertyGroup = keyof typeof DESIGN_PROPERTY_GROUPS | "other";
export type DesignProperty = (typeof DESIGN_PROPERTIES)[number];

export interface VariableBinding {
  property: string;
  bindingType: "normal" | "array";
  arrayIndex?: number;
  variableName: string;
  collectionName: string;
  aliasName?: string;
  isAlias: boolean;
  variableType: string;
}

export interface GroupedBindings {
  colors: VariableBinding[];
  spacing: VariableBinding[];
  sizing: VariableBinding[];
  typography: VariableBinding[];
  effects: VariableBinding[];
  other: VariableBinding[];
}

// Design property constants
export const DESIGN_PROPERTY_GROUPS = {
  colors: [
    "fills",
    "strokes",
    "backgroundColor",
    "borderColor",
    "textColor",
    "fill",
    "stroke",
  ],
  spacing: [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "itemSpacing",
    "counterAxisSpacing",
  ],
  sizing: ["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight"],
  typography: [
    "fontFamily",
    "fontWeight",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textDecoration",
  ],
  effects: ["effects", "shadow", "blur", "opacity", "effectStyleId"],
} as const;

export const DESIGN_PROPERTIES = Object.values(DESIGN_PROPERTY_GROUPS).flat();

// Message types for UI communication
export interface GetSectionsMessage {
  type: "get-sections";
}

export interface AnalyzeSectionMessage {
  type: "analyze-section";
  sectionId: string;
}

export interface JumpToNodeMessage {
  type: "jump-to-node";
  nodeId: string;
}

export interface CancelMessage {
  type: "cancel";
}

export type UIMessage =
  | GetSectionsMessage
  | AnalyzeSectionMessage
  | JumpToNodeMessage
  | CancelMessage;

export interface SectionsLoadedResponse {
  type: "sections-loaded";
  sections: any[];
  selectedSectionId: string | null;
}

export interface SectionAnalysisResponse {
  type: "section-analysis";
  analysis: SectionAnalysis | null;
}

export interface SelectionSectionResponse {
  type: "selection-section";
  sectionId: string | null;
}

export interface NodeJumpedResponse {
  type: "node-jumped";
  nodeName: string;
  nodeType: string;
}

export type UIResponse =
  | SectionsLoadedResponse
  | SectionAnalysisResponse
  | SelectionSectionResponse
  | NodeJumpedResponse;
