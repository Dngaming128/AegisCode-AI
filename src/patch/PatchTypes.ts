export type PatchKind =
  | "remove-unused-import"
  | "remove-unused-variable"
  | "mark-parameter-used"
  | "add-unknown-parameter-type";

export interface PatchProposal {
  id: string;
  filePath: string;
  kind: PatchKind;
  description: string;
  confidence: number;
  targetPos: number;
}

export interface AppliedPatch {
  proposal: PatchProposal;
  before: string;
  after: string;
}

export interface PatchApplicationResult {
  appliedCount: number;
  patches: AppliedPatch[];
  backupFiles: Record<string, string>;
}
