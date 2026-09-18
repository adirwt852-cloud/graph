import { ConfidenceLevel, SimulationResult } from '../../graph-builder/src/types';

export interface PrCommentOptions {
  confidenceThreshold?: ConfidenceLevel; // 'high' | 'medium' | 'low'
  reportArtifactUrl?: string;
  prNumber?: number;
  commitSha?: string;
}

export class PrCommentFormatter {
  public static formatPrComment(
    simulationResult: SimulationResult,
    options: PrCommentOptions = {}
  ): string | null {
    const minConfidence = options.confidenceThreshold || 'medium';
    const confidenceRanks: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
    const minRank = confidenceRanks[minConfidence];

    // Filter affected nodes according to confidence threshold
    const impactedNodes = Object.values(simulationResult.nodes).filter(res => {
      if (res.status === 'Safe') return false;
      // If node has edgePath, verify if any edge meets threshold
      if (res.edgePath && res.edgePath.length > 0) {
        return res.edgePath.some(e => (confidenceRanks[e.confidence] || 2) >= minRank);
      }
      return true;
    });

    const failedCount = impactedNodes.filter(n => n.status === 'Failed').length;
    const affectedCount = impactedNodes.filter(n => n.status === 'Affected').length;
    const degradedCount = impactedNodes.filter(n => n.status === 'Degraded').length;
    const totalImpacted = failedCount + affectedCount + degradedCount;

    // NOISE CONTROL: If total impacted count is 0, do not post comment!
    if (totalImpacted === 0) {
      return null;
    }

    const reportUrl = options.reportArtifactUrl || '#';
    const scenarioName = simulationResult.scenario.name;

    // Build Markdown Comment with collapsible details
    return `## 🔍 GraphFlow Blast Radius Analysis

> **Scenario Simulated:** \`${scenarioName}\`
> **Impact Overview:** 🔴 **${failedCount} Failed** | 🟡 **${degradedCount} Degraded** | 🟠 **${affectedCount} Affected** | 🟢 **${simulationResult.statusCounts.Safe} Safe**

### 📊 Blast Radius Summary Table

| Category | Node | Status | File & Line | Root Cause / Explanation |
| :--- | :--- | :---: | :--- | :--- |
${impactedNodes.map(res => {
  const node = res.node;
  const statusBadge = res.status === 'Failed' ? '❌ **Failed**' : res.status === 'Degraded' ? '🟡 **Degraded**' : '🟠 **Affected**';
  const fileRef = node.file ? `\`${node.file.split('/').slice(-2).join('/')}:${node.line}\`` : '`N/A`';
  const cleanReason = res.reason.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return `| **${node.type}** | \`${node.name}\` | ${statusBadge} | ${fileRef} | ${cleanReason} |`;
}).join('\n')}

<details>
<summary><b>🔎 View Detailed Call Paths & Field Blame (${impactedNodes.length} nodes)</b></summary>

${impactedNodes.map(res => {
  const pathStr = res.propagationPath.length > 0 ? res.propagationPath.join(' ➔ ') : res.node.name;
  return `
#### \`${res.node.name}\` (${res.status})
- **Type:** ${res.node.type}
- **Source Location:** \`${res.node.file}:${res.node.line}\`
- **Propagation Path:** \`${pathStr}\`
- **Analysis:** ${res.reason}
${res.fieldBlame ? `- **Field Blame:** \`${res.fieldBlame.field}\` (${res.fieldBlame.confidence} confidence) - ${res.fieldBlame.explanation}` : ''}
`;
}).join('\n')}

</details>

---
📄 **Full Interactive Report:** [View GraphFlow Interactive Visualizer](${reportUrl})
*Analyzed by GraphFlow Engine (Confidence Threshold: \`${minConfidence}\`)*
`;
  }
}
