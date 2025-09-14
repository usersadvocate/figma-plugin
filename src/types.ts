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

export interface AuditResult {
  containerId: string;
  containerName: string;
  summary: AuditSummary;
  withVariables: AuditableNode[];
  withoutVariables: AuditableNode[];
  lintFindings: LintFinding[];
  coveragePercentage: number;
}

export interface AuditSummary {
  totalAuditableNodes: number;
  withVariablesCount: number;
  withLocalVariablesCount: number;
  withGlobalVariablesCount: number;
  withoutVariablesCount: number;
}

export interface AuditableNode {
  id: string;
  name: string;
  type: AuditableNodeType;
  framePath: string;
  classification: NodeClassification;
  variableBindings: VariableBinding[];
  lintFindings: LintFinding[];
  hasLocalVariables: boolean;
  hasGlobalVariables: boolean;
}

export type AuditableNodeType =
  | "TEXT"
  | "FRAME"
  | "RECTANGLE"
  | "COMPONENT"
  | "INSTANCE"
  | "ELLIPSE"
  | "POLYGON"
  | "STAR"
  | "VECTOR"
  | "LINE";

export type NodeClassification =
  | "USES_VARIABLES_LOCAL"
  | "USES_VARIABLES_GLOBAL"
  | "USES_VARIABLES_MIXED"
  | "NO_VARIABLES";

export interface LintFinding {
  nodeId: string;
  rule: LintRule;
  severity: "error" | "warning" | "info";
  message: string;
  property?: string;
  details?: Record<string, unknown>;
}

export type LintRule =
  | "NoVariables"
  | "MixedText"
  | "ConflictingStyleVsVariable"
  | "MagicNumbers"
  | "UnresolvableVariable";

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
  variableId: string;
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

export interface AuditContainerMessage {
  type: "audit-container";
  containerId: string;
}

export interface JumpToNodeMessage {
  type: "jump-to-node";
  nodeId: string;
}

export interface CancelMessage {
  type: "cancel";
}

export interface ResizeMessage {
  type: "resize";
  size: {
    width: number;
    height: number;
  };
}

export interface GetContainerInfoMessage {
  type: "get-container-info";
  containerId: string;
}

export type UIMessage =
  | GetSectionsMessage
  | AnalyzeSectionMessage
  | AuditContainerMessage
  | GetContainerInfoMessage
  | JumpToNodeMessage
  | CancelMessage
  | ResizeMessage;

export interface SectionsLoadedResponse {
  type: "sections-loaded";
  sections: SectionNode[];
  selectedSectionId: string | null;
}

export interface SectionAnalysisResponse {
  type: "section-analysis";
  analysis: SectionAnalysis | null;
}

export interface AuditResultResponse {
  type: "audit-result";
  audit: AuditResult | null;
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

export interface ContainerInfoResponse {
  type: "container-info";
  id: string;
  name: string;
  containerType: "SECTION" | "FRAME";
}

export type UIResponse =
  | SectionsLoadedResponse
  | SectionAnalysisResponse
  | AuditResultResponse
  | SelectionSectionResponse
  | NodeJumpedResponse
  | ContainerInfoResponse;
