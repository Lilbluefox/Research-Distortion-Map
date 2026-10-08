export type RoleId = "customer" | "researcher" | "respondent";

export type StageId =
  | "task"
  | "methodology"
  | "sample"
  | "collection"
  | "analysis"
  | "reporting";

export type Role = {
  id: RoleId;
  title: string;
  shortTitle: string;
  description: string;
};

export type Stage = {
  id: StageId;
  title: string;
  shortTitle: string;
  order: number;
  description: string;
};

export type StageEffect = {
  stageId: StageId;
  effect: string;
  intensity: "low" | "medium" | "high";
};

export type RoleEffect = {
  roleId: RoleId;
  effect: string;
};

export type SourceNote = {
  title: string;
  status: "placeholder" | "draft" | "verified";
  url?: string;
  notes?: string;
};

export type Distortion = {
  id: string;
  title: string;
  roleId: RoleId;
  stageId: StageId;
  label: string;
  summary: string;
  mechanism: string;
  stageEffects: StageEffect[];
  roleEffects: RoleEffect[];
  finalConclusion: string;
  sourceNotes: SourceNote[];
};

export type ModelData = {
  roles: Role[];
  stages: Stage[];
  distortions: Distortion[];
};
