import type { Distortion, Role, RoleEffect, RoleId, Stage, StageEffect, StageId } from "./types";

export function byOrder(stages: Stage[]) {
  return [...stages].sort((a, b) => a.order - b.order);
}

export function findRole(roles: Role[], id: RoleId) {
  return roles.find((role) => role.id === id);
}

export function findStage(stages: Stage[], id: StageId) {
  return stages.find((stage) => stage.id === id);
}

export function getStageEffect(distortion: Distortion, stageId: StageId): StageEffect | undefined {
  return distortion.stageEffects.find((effect) => effect.stageId === stageId);
}

export function getRoleEffect(distortion: Distortion, roleId: RoleId): RoleEffect | undefined {
  return distortion.roleEffects.find((effect) => effect.roleId === roleId);
}

export function isAffectedStage(distortion: Distortion, stageId: StageId) {
  return distortion.stageEffects.some((effect) => effect.stageId === stageId);
}

export function intensityLabel(intensity: StageEffect["intensity"]) {
  const labels: Record<StageEffect["intensity"], string> = {
    low: "низкое",
    medium: "среднее",
    high: "сильное",
  };

  return labels[intensity];
}

export function sourceStatusLabel(status: "placeholder" | "draft" | "verified") {
  const labels: Record<typeof status, string> = {
    placeholder: "нужно добавить",
    draft: "черновик",
    verified: "проверено",
  };

  return labels[status];
}
