import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(rootDir, "src", "data", "modelData.json");
const sheetId = process.env.GOOGLE_SHEET_ID ?? "1lo70gLSoVT94e-1nhTwo5ARnjBRKpHIh6B31UUFXkzo";

const tabs = {
  roles: "Классы",
  stages: "Среды",
  distortions: "Искажения",
  stageEffects: "Эффекты по средам",
  roleEffects: "Эффекты по классам",
  sources: "Источники",
};

function csvUrl(sheetName) {
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName,
  });
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params.toString()}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim() !== ""));
}

function objectsFromRows(rows) {
  const [headers, ...body] = rows;
  return body.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

async function fetchTab(sheetName) {
  const response = await fetch(csvUrl(sheetName));
  if (!response.ok) {
    throw new Error(`Не удалось прочитать вкладку "${sheetName}": ${response.status} ${response.statusText}`);
  }
  return objectsFromRows(parseCsv(await response.text()));
}

function required(value, label) {
  if (!value) {
    throw new Error(`Пустое обязательное поле: ${label}`);
  }
  return value;
}

const [roles, stages, distortions, stageEffects, roleEffects, sources] = await Promise.all([
  fetchTab(tabs.roles),
  fetchTab(tabs.stages),
  fetchTab(tabs.distortions),
  fetchTab(tabs.stageEffects),
  fetchTab(tabs.roleEffects),
  fetchTab(tabs.sources),
]);

const roleIds = new Set(roles.map((role) => role.roleId));
const stageIds = new Set(stages.map((stage) => stage.stageId));
const distortionIds = new Set(distortions.map((distortion) => distortion.distortionId));

const model = {
  roles: roles.map((role) => ({
    id: required(role.roleId, "Классы.roleId"),
    title: required(role.title, "Классы.title"),
    shortTitle: role.shortTitle || role.title,
    description: role.description || "",
  })),
  stages: stages.map((stage) => ({
    id: required(stage.stageId, "Среды.stageId"),
    title: required(stage.title, "Среды.title"),
    shortTitle: stage.shortTitle || stage.title,
    order: Number(required(stage.order, "Среды.order")),
    description: stage.description || "",
  })),
  distortions: distortions.map((distortion) => {
    const distortionId = required(distortion.distortionId, "Искажения.distortionId");
    const roleId = required(distortion.roleId, `${distortionId}.roleId`);
    const stageId = required(distortion.stageId, `${distortionId}.stageId`);

    if (!roleIds.has(roleId)) {
      throw new Error(`Неизвестный roleId "${roleId}" в искажении "${distortionId}"`);
    }
    if (!stageIds.has(stageId)) {
      throw new Error(`Неизвестный stageId "${stageId}" в искажении "${distortionId}"`);
    }

    return {
      id: distortionId,
      title: required(distortion.title, `${distortionId}.title`),
      roleId,
      stageId,
      label: distortion.label || "А",
      summary: distortion.summary || "",
      mechanism: distortion.mechanism || "",
      stageEffects: stageEffects
        .filter((effect) => effect.distortionId === distortionId)
        .map((effect) => ({
          stageId: required(effect.stageId, `${distortionId}.stageEffects.stageId`),
          intensity: effect.intensity || "medium",
          effect: required(effect.effect, `${distortionId}.stageEffects.effect`),
        })),
      roleEffects: roleEffects
        .filter((effect) => effect.distortionId === distortionId)
        .map((effect) => ({
          roleId: required(effect.roleId, `${distortionId}.roleEffects.roleId`),
          effect: required(effect.effect, `${distortionId}.roleEffects.effect`),
        })),
      finalConclusion: distortion.finalConclusion || "",
      sourceNotes: sources
        .filter((source) => source.distortionId === distortionId)
        .map((source) => ({
          title: required(source.title, `${distortionId}.sources.title`),
          status: source.status || "placeholder",
          url: source.url || "",
          notes: source.notes || "",
        })),
    };
  }),
};

for (const effect of [...stageEffects, ...roleEffects, ...sources]) {
  if (effect.distortionId && !distortionIds.has(effect.distortionId)) {
    throw new Error(`Строка ссылается на неизвестное искажение "${effect.distortionId}"`);
  }
}

await fs.writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}`);
