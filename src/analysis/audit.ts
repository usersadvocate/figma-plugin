// Comprehensive audit engine for variable usage analysis
import {
  AuditResult,
  AuditSummary,
  AuditableNode,
  AuditableNodeType,
  NodeClassification,
  LintFinding,
  VariableBinding,
} from "../types";
import { extractVariableBindings } from "./variables";

const AUDITABLE_NODE_TYPES: AuditableNodeType[] = [
  "TEXT",
  "FRAME",
  "RECTANGLE",
  "COMPONENT",
  "INSTANCE",
  "ELLIPSE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "LINE",
];

// Main audit function
export async function auditContainer(
  containerId: string
): Promise<AuditResult | null> {
  try {
    console.log("🔍 Starting comprehensive audit for container:", containerId);

    const container = await figma.getNodeByIdAsync(containerId);
    if (
      !container ||
      (container.type !== "SECTION" && container.type !== "FRAME")
    ) {
      console.error("Container not found or invalid type");
      return null;
    }

    // Collect all auditable nodes
    const allNodes = await collectAuditableNodes(container);
    console.log(`📊 Found ${allNodes.length} auditable nodes`);

    // Limit to first 50 nodes to prevent freezing during testing
    const auditableNodes = allNodes.slice(0, 50);
    if (auditableNodes.length < allNodes.length) {
      console.log(
        `⚠️ Limited to first ${auditableNodes.length} nodes for performance`
      );
    }

    console.log(
      "📋 Node types found:",
      auditableNodes.map((n) => `${n.name} (${n.type})`).slice(0, 5)
    );

    // Classify nodes and apply lint rules
    const processedNodes: AuditableNode[] = [];
    const allLintFindings: LintFinding[] = [];

    for (const node of auditableNodes) {
      const processedNode = await processNode(node);
      console.log(
        `🔍 Processed ${node.name} (${node.type}): ${processedNode.classification}, ${processedNode.variableBindings.length} bindings`
      );
      processedNodes.push(processedNode);
      allLintFindings.push(...processedNode.lintFindings);
    }

    // Separate nodes by classification
    const withVariables = processedNodes.filter(
      (n) => n.classification !== "NO_VARIABLES"
    );
    const withoutVariables = processedNodes.filter(
      (n) => n.classification === "NO_VARIABLES"
    );

    // Calculate summary
    const summary = calculateSummary(processedNodes);

    // Calculate coverage percentage
    const coveragePercentage =
      summary.totalAuditableNodes > 0
        ? (summary.withVariablesCount / summary.totalAuditableNodes) * 100
        : 0;

    const result: AuditResult = {
      containerId: container.id,
      containerName: container.name,
      summary,
      withVariables,
      withoutVariables,
      lintFindings: allLintFindings,
      coveragePercentage,
    };

    console.log(
      `✅ Audit complete: ${
        summary.totalAuditableNodes
      } nodes, ${coveragePercentage.toFixed(1)}% coverage`
    );
    return result;
  } catch (error) {
    console.error("❌ Error during audit:", error);
    return null;
  }
}

// Helper function to check if a node is effectively visible (not hidden by itself or parents)
function isNodeEffectivelyVisible(
  node: SceneNode,
  rootFrame?: FrameNode
): boolean {
  // Check if this node is directly hidden
  if ("visible" in node && node.visible === false) {
    return false;
  }

  // Check if any parent in the hierarchy is hidden (up to the root frame)
  let parent = node.parent;
  while (parent && parent !== rootFrame) {
    if ("visible" in parent && parent.visible === false) {
      return false;
    }
    parent = parent.parent;
  }

  return true;
}

// Collect all auditable nodes from a container
async function collectAuditableNodes(
  container: SceneNode
): Promise<SceneNode[]> {
  const nodes: SceneNode[] = [];

  function traverse(node: SceneNode, rootFrame?: FrameNode) {
    // Check if this node type is auditable and visible
    if (AUDITABLE_NODE_TYPES.includes(node.type as AuditableNodeType)) {
      const isVisible = isNodeEffectivelyVisible(node, rootFrame);
      if (isVisible) {
        nodes.push(node);
      } else {
        console.log(
          `🙈 Excluding hidden node from audit: "${node.name}" (${node.type})`
        );
      }
    }

    // Recursively traverse children
    if ("children" in node && node.children) {
      for (const child of node.children) {
        traverse(child, rootFrame);
      }
    }
  }

  if (container.type === "SECTION") {
    // For sections, analyze child frames
    for (const child of container.children) {
      if (child.type === "FRAME") {
        traverse(child, child as FrameNode);
      }
    }
  } else {
    // For frames, analyze the frame itself and its children
    traverse(container, container as FrameNode);
  }

  return nodes;
}

// Process a single node: classify it and apply lint rules
async function processNode(node: SceneNode): Promise<AuditableNode> {
  const variableBindings = await extractVariableBindings(node);
  const framePath = getFramePath(node);

  // Determine if variables are local or global
  const { hasLocal, hasGlobal } = await analyzeVariableTypes(variableBindings);

  // Classify the node
  const classification = classifyNode(variableBindings, hasLocal, hasGlobal);

  // Apply lint rules
  const lintFindings = await applyLintRules(node, variableBindings);

  return {
    id: node.id,
    name: node.name,
    type: node.type as AuditableNodeType,
    framePath,
    classification,
    variableBindings,
    lintFindings,
    hasLocalVariables: hasLocal,
    hasGlobalVariables: hasGlobal,
  };
}

// Analyze whether variables are local or global (simplified for performance)
async function analyzeVariableTypes(
  bindings: VariableBinding[]
): Promise<{ hasLocal: boolean; hasGlobal: boolean }> {
  // For now, assume all variables are local to avoid expensive lookups
  // TODO: Implement proper remote detection when performance issues are resolved
  const hasLocal = bindings.length > 0;
  const hasGlobal = false;

  return { hasLocal, hasGlobal };
}

// Classify a node based on its variable usage
function classifyNode(
  bindings: VariableBinding[],
  hasLocal: boolean,
  hasGlobal: boolean
): NodeClassification {
  if (bindings.length === 0) {
    return "NO_VARIABLES";
  }

  if (hasLocal && hasGlobal) {
    return "USES_VARIABLES_MIXED";
  } else if (hasGlobal) {
    return "USES_VARIABLES_GLOBAL";
  } else {
    return "USES_VARIABLES_LOCAL";
  }
}

// Get the frame path for a node (breadcrumb trail)
function getFramePath(node: SceneNode): string {
  const path: string[] = [];
  let current: BaseNode | null = node.parent;

  while (current && current.type !== "PAGE") {
    if (current.type === "FRAME" || current.type === "SECTION") {
      path.unshift(current.name);
    }
    current = current.parent;
  }

  return path.join(" > ") || "Root";
}

// Apply all lint rules to a node
async function applyLintRules(
  node: SceneNode,
  bindings: VariableBinding[]
): Promise<LintFinding[]> {
  const findings: LintFinding[] = [];

  // Rule 1: NoVariables
  if (bindings.length === 0) {
    findings.push({
      nodeId: node.id,
      rule: "NoVariables",
      severity: "warning",
      message: "Node has no variable bindings - using manual values only",
    });
  }

  // Rule 2: MixedText (for TEXT nodes)
  if (node.type === "TEXT") {
    const mixedTextFindings = await checkMixedText(node as TextNode, bindings);
    findings.push(...mixedTextFindings);
  }

  // Rule 3: ConflictingStyleVsVariable
  const styleConflictFindings = await checkStyleConflicts(node, bindings);
  findings.push(...styleConflictFindings);

  // Rule 4: MagicNumbers (for FRAME nodes with auto-layout)
  if (node.type === "FRAME") {
    const magicNumberFindings = checkMagicNumbers(node as FrameNode, bindings);
    findings.push(...magicNumberFindings);
  }

  // Rule 5: UnresolvableVariable
  const unresolvableFindings = await checkUnresolvableVariables(bindings);
  findings.push(...unresolvableFindings);

  return findings;
}

// Check for mixed text styling
async function checkMixedText(
  node: TextNode,
  bindings: VariableBinding[]
): Promise<LintFinding[]> {
  const findings: LintFinding[] = [];

  // Check if text has styled segments with mixed variable/manual usage
  // This is a simplified check - would need more complex logic for segment analysis
  if (node.characters && node.characters.length > 0) {
    const textProperties = ["fontSize", "fontFamily", "fontWeight", "fills"];
    const boundProperties = bindings.map((b) => b.property);

    let hasBoundText = false;
    let hasUnboundText = false;

    for (const prop of textProperties) {
      if (boundProperties.includes(prop)) {
        hasBoundText = true;
      } else {
        // Check if property has a manual value (simplified)
        hasUnboundText = true;
      }
    }

    if (hasBoundText && hasUnboundText) {
      findings.push({
        nodeId: node.id,
        rule: "MixedText",
        severity: "warning",
        message: "Text node has mixed variable-bound and manual styling",
      });
    }
  }

  return findings;
}

// Check for conflicting styles vs variables
async function checkStyleConflicts(
  node: SceneNode,
  bindings: VariableBinding[]
): Promise<LintFinding[]> {
  const findings: LintFinding[] = [];

  // Check if node has legacy styles where variables are expected
  if ("fillStyleId" in node && node.fillStyleId && node.fillStyleId !== "") {
    const hasFillVariable = bindings.some((b) => b.property === "fills");
    if (!hasFillVariable) {
      findings.push({
        nodeId: node.id,
        rule: "ConflictingStyleVsVariable",
        severity: "info",
        message: "Node uses legacy fill style instead of color variables",
        property: "fills",
      });
    }
  }

  if (
    "strokeStyleId" in node &&
    node.strokeStyleId &&
    node.strokeStyleId !== ""
  ) {
    const hasStrokeVariable = bindings.some((b) => b.property === "strokes");
    if (!hasStrokeVariable) {
      findings.push({
        nodeId: node.id,
        rule: "ConflictingStyleVsVariable",
        severity: "info",
        message: "Node uses legacy stroke style instead of color variables",
        property: "strokes",
      });
    }
  }

  return findings;
}

// Check for magic numbers in auto-layout frames
function checkMagicNumbers(
  node: FrameNode,
  bindings: VariableBinding[]
): LintFinding[] {
  const findings: LintFinding[] = [];

  // Check if frame has auto-layout
  if (node.layoutMode !== "NONE") {
    const spacingProperties = [
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "itemSpacing",
    ];
    const boundProperties = bindings.map((b) => b.property);

    for (const prop of spacingProperties) {
      if (!boundProperties.includes(prop)) {
        // Check if property has a non-zero value (simplified)
        let hasValue = false;
        if (prop === "itemSpacing" && node.itemSpacing > 0) hasValue = true;
        if (prop.startsWith("padding") && node.paddingTop > 0) hasValue = true; // Simplified

        if (hasValue) {
          findings.push({
            nodeId: node.id,
            rule: "MagicNumbers",
            severity: "warning",
            message: `Auto-layout ${prop} uses magic number instead of spacing variable`,
            property: prop,
          });
        }
      }
    }
  }

  return findings;
}

// Check for unresolvable variables
async function checkUnresolvableVariables(
  bindings: VariableBinding[]
): Promise<LintFinding[]> {
  const findings: LintFinding[] = [];

  for (const binding of bindings) {
    // If the variable name looks like an ID (from our fallback), it's unresolvable
    if (binding.variableName.startsWith("[Variable ID:")) {
      findings.push({
        nodeId: "", // Will be set by caller
        rule: "UnresolvableVariable",
        severity: "error",
        message: `Variable reference cannot be resolved: ${binding.variableName}`,
        property: binding.property,
      });
    }
  }

  return findings;
}

// Calculate summary statistics
function calculateSummary(nodes: AuditableNode[]): AuditSummary {
  const totalAuditableNodes = nodes.length;
  const withVariablesNodes = nodes.filter(
    (n) => n.classification !== "NO_VARIABLES"
  );
  const withLocalOnly = nodes.filter(
    (n) => n.classification === "USES_VARIABLES_LOCAL"
  );
  const withGlobalOnly = nodes.filter(
    (n) => n.classification === "USES_VARIABLES_GLOBAL"
  );
  const withMixed = nodes.filter(
    (n) => n.classification === "USES_VARIABLES_MIXED"
  );

  return {
    totalAuditableNodes,
    withVariablesCount: withVariablesNodes.length,
    withLocalVariablesCount: withLocalOnly.length + withMixed.length,
    withGlobalVariablesCount: withGlobalOnly.length + withMixed.length,
    withoutVariablesCount: totalAuditableNodes - withVariablesNodes.length,
  };
}
