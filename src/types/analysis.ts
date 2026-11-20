export type AnalysisMode = 'auto' | 'math' | 'prompt' | 'data' | 'sql' | 'code';

export type AuditRigor = 'standard' | 'strict' | 'academic';

export type OutputLanguage = 'english' | 'roman_urdu' | 'bilingual';

export type VerdictStatus = 'valid' | 'needs_refinement' | 'flawed';

export type IssueSeverity = 'critical' | 'warning' | 'suggestion';

export interface AnalysisIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  evidence: string;
  explanation: string;
  fixApplied: string;
}

export interface SymbolDefinition {
  symbol: string;
  dataType: string;
  role: string;
  domainConstraint: string;
}

export interface EquationStep {
  stepLabel: string;
  expressionLatex: string;
  explanation: string;
}

export interface PatternComparisonItem {
  patternName: string;
  category: string;
  whyGood: string;
  whenToUse: string;
  exampleSnippet: string;
}

export interface AntiPatternItem {
  patternName: string;
  category: string;
  whyBad: string;
  failureMode: string;
  exampleFlaw: string;
}

export interface ResolutionChange {
  area: string;
  beforeSummary: string;
  afterSummary: string;
  reason: string;
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  title: string;
  detectedType: string;
  modeUsed: AnalysisMode;
  languageUsed: OutputLanguage;
  rigorUsed?: AuditRigor;
  verdict: VerdictStatus;
  verdictHeadline: string;
  executiveSummary: string;
  intentAnalysis: string;
  variablesAndSymbols: SymbolDefinition[];
  equationSteps: EquationStep[];
  issues: AnalysisIssue[];
  goodPatterns: PatternComparisonItem[];
  badPatterns: AntiPatternItem[];
  patternDifferentiationSummary: string;
  isCorrectAsIs: boolean;
  resolvedOutput: string;
  resolvedOutputFormat: 'markdown' | 'json' | 'sql' | 'code' | 'text';
  changesLog: ResolutionChange[];
  verificationSteps: string[];
  originalInput: string;
}

export interface FollowUpMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface SavedSession {
  analysis: AnalysisResult;
  followUps: FollowUpMessage[];
}
