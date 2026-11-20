import { AnalysisResult, SymbolDefinition } from '../types/analysis';

export type VariableTypeFamily = 'numeric' | 'discrete' | 'text_collection' | 'constraint_other';

export interface VariableNode {
  id: string;
  orderIndex: number;
  symbol: string;
  dataType: string;
  typeFamily: VariableTypeFamily;
  role: string;
  domainConstraint: string;
  mentions: number;
  constraintCount: number;
  hasIssue: boolean;
}

export interface VariableLink {
  source: string;
  target: string;
  weight: number;
  contexts: string[];
}

export interface ScatterPoint {
  id: string;
  orderIndex: number;
  symbol: string;
  x: number;
  y: number;
  dataType: string;
  typeFamily: VariableTypeFamily;
  role: string;
  domainConstraint: string;
  hasIssue: boolean;
}

export interface VariableGraphData {
  nodes: VariableNode[];
  links: VariableLink[];
  scatterPoints: ScatterPoint[];
  xAxisLabel: string;
  yAxisLabel: string;
}

export function classifyTypeFamily(dataType: string, symbol: string): VariableTypeFamily {
  const combined = `${dataType} ${symbol}`.toLowerCase();
  if (
    combined.includes('real') ||
    combined.includes('ℝ') ||
    combined.includes('float') ||
    combined.includes('decimal') ||
    combined.includes('double') ||
    combined.includes('numeric') ||
    combined.includes('scalar') ||
    combined.includes('currency')
  ) {
    return 'numeric';
  }
  if (
    combined.includes('int') ||
    combined.includes('ℤ') ||
    combined.includes('ℕ') ||
    combined.includes('count') ||
    combined.includes('index') ||
    combined.includes('bool')
  ) {
    return 'discrete';
  }
  if (
    combined.includes('string') ||
    combined.includes('array') ||
    combined.includes('object') ||
    combined.includes('json') ||
    combined.includes('date') ||
    combined.includes('table') ||
    combined.includes('text')
  ) {
    return 'text_collection';
  }
  return 'constraint_other';
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(haystack: string, needle: string): number {
  const clean = needle.trim();
  if (!clean) return 0;
  try {
    const isAlphaNum = /^[a-zA-Z0-9_]+$/.test(clean);
    const pattern = isAlphaNum ? `\\b${escapeRegExp(clean)}\\b` : escapeRegExp(clean);
    const matches = haystack.match(new RegExp(pattern, 'g'));
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

function countConstraints(constraint: string): number {
  const trimmed = constraint.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed === '—' || trimmed === '-') {
    return 0;
  }
  const parts = trimmed.split(/[,;&|]+/).map((p) => p.trim()).filter(Boolean);
  return Math.max(1, parts.length);
}

export function buildVariableGraphData(analysis: AnalysisResult): VariableGraphData {
  const symbols: SymbolDefinition[] = analysis.variablesAndSymbols ?? [];
  const steps = analysis.equationSteps ?? [];
  const issues = analysis.issues ?? [];

  const combinedCorpus = [
    analysis.originalInput,
    analysis.intentAnalysis,
    ...steps.map((s) => s.expressionLatex),
    ...issues.map((i) => `${i.evidence} ${i.explanation}`),
  ].join('\n');

  const issueCorpus = issues.map((i) => `${i.title} ${i.evidence} ${i.explanation}`).join('\n');

  const nodes: VariableNode[] = symbols.map((item, idx) => {
    const id = `${item.symbol}__${idx}`;
    const mentions = Math.max(1, countOccurrences(combinedCorpus, item.symbol));
    const constraintCount = countConstraints(item.domainConstraint);
    const hasIssue = countOccurrences(issueCorpus, item.symbol) > 0;

    return {
      id,
      orderIndex: idx + 1,
      symbol: item.symbol,
      dataType: item.dataType,
      typeFamily: classifyTypeFamily(item.dataType, item.symbol),
      role: item.role,
      domainConstraint: item.domainConstraint,
      mentions,
      constraintCount,
      hasIssue,
    };
  });

  // Build co-occurrence links across equation steps, input lines, and issues
  const contexts: { label: string; text: string }[] = [
    ...steps.map((s) => ({ label: s.stepLabel, text: `${s.expressionLatex} ${s.explanation}` })),
    ...analysis.originalInput
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .slice(0, 40)
      .map((line, idx) => ({ label: `Input line ${idx + 1}`, text: line })),
  ];

  const linkMap = new Map<string, VariableLink>();

  for (const ctx of contexts) {
    const present = nodes.filter((n) => countOccurrences(ctx.text, n.symbol) > 0);
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const a = present[i].id;
        const b = present[j].id;
        const key = a < b ? `${a}|||${b}` : `${b}|||${a}`;
        const existing = linkMap.get(key);
        if (existing) {
          existing.weight += 1;
          if (!existing.contexts.includes(ctx.label) && existing.contexts.length < 4) {
            existing.contexts.push(ctx.label);
          }
        } else {
          linkMap.set(key, {
            source: a,
            target: b,
            weight: 1,
            contexts: [ctx.label],
          });
        }
      }
    }
  }

  const links = Array.from(linkMap.values());

  // Scatter points plot exact factual occurrences (X) vs explicit domain constraints (Y)
  const scatterPoints: ScatterPoint[] = nodes.map((node) => ({
    id: node.id,
    orderIndex: node.orderIndex,
    symbol: node.symbol,
    x: node.mentions,
    y: node.constraintCount,
    dataType: node.dataType,
    typeFamily: node.typeFamily,
    role: node.role,
    domainConstraint: node.domainConstraint,
    hasIssue: node.hasIssue,
  }));

  return {
    nodes,
    links,
    scatterPoints,
    xAxisLabel: 'References Across Input & Proof Steps',
    yAxisLabel: 'Domain & Type Constraints',
  };
}
