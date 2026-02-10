export interface MemoryEntry {
  timestamp: string;
  success: boolean;
  rationale: string;
  patchCount: number;
  confidence: number;
}

export interface MemoryState {
  shortTerm: MemoryEntry[];
  longTerm: MemoryEntry[];
  failurePatterns: Record<string, number>;
  confidenceHistory: number[];
  successRate: number;
}
