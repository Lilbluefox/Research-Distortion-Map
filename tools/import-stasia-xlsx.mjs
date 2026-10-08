import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const sourcePath = "C:/Users/user/Downloads/Telegram Desktop/Данные_интерактивной_модели_искажений.xlsx";
const outputDir = path.resolve("outputs", "stasia-import");
const modelOutputPath = path.resolve("src", "data", "modelData.json");
const rowsOutputPath = path.join(outputDir, "normalized-rows.json");
const modelPreviewPath = path.join(outputDir, "modelData.preview.json");

const tabs = {
  roles: "Классы",
  stages: "Среды",
  distortions: "Искажения",
  stageEffects: "Эффекты по средам",
  roleEffects: "Эффекты по классам",
  sources: "Источники",
};

await fs.mkdir(outputDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function rowsFromSheet(sheetName) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const values = sheet.getUsedRange().values ?? [];
  const [headersRaw, ...dataRows] = values;
  const headers = headersRaw.map(clean);
  return dataRows
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, clean(row[index])])))
    .filter((row) => Object.values(row).some((value) => clean(value) !== ""));
}

const rows = {
  roles: rowsFromSheet(tabs.roles),
  stages: rowsFromSheet(tabs.stages),
  distortions: rowsFromSheet(tabs.distortions),
  stageEffects: rowsFromSheet(tabs.stageEffects),
  roleEffects: rowsFromSheet(tabs.roleEffects),
  sources: rowsFromSheet(tabs.sources),
};

const roleIds = new Set(rows.roles.map((role) => role.roleId));
const stageIds = new Set(rows.stages.map((stage) => stage.stageId));
const distortionIds = new Set(rows.distortions.map((distortion) => distortion.distortionId));
const allowedIntensity = new Set(["low", "medium", "high"]);
const allowedSourceStatus = new Set(["placeholder", "draft", "verified"]);
const errors = [];

function required(value, label) {
  if (!clean(value)) {
    errors.push(`Пустое обязательное поле: ${label}`);
  }
  return clean(value);
}

const model = {
  roles: rows.roles.map((role) => ({
    id: required(role.roleId, "Классы.roleId"),
    title: required(role.title, "Классы.title"),
    shortTitle: clean(role.shortTitle) || clean(role.title),
    description: clean(role.description),
  })),
  stages: rows.stages.map((stage) => ({
    id: required(stage.stageId, "Среды.stageId"),
    title: required(stage.title, "Среды.title"),
    shortTitle: clean(stage.shortTitle) || clean(stage.title),
    order: Number(required(stage.order, "Среды.order")),
    description: clean(stage.description),
  })),
  distortions: rows.distortions.map((distortion) => {
    const id = required(distortion.distortionId, "Искажения.distortionId");
    const roleId = required(distortion.roleId, `${id}.roleId`);
    const stageId = required(distortion.stageId, `${id}.stageId`);

    if (roleId && !roleIds.has(roleId)) {
      errors.push(`Неизвестный roleId "${roleId}" в искажении "${id}"`);
    }
    if (stageId && !stageIds.has(stageId)) {
      errors.push(`Неизвестный stageId "${stageId}" в искажении "${id}"`);
    }

    return {
      id,
      title: required(distortion.title, `${id}.title`),
      roleId,
      stageId,
      label: clean(distortion.label) || "А",
      summary: clean(distortion.summary),
      mechanism: clean(distortion.mechanism),
      stageEffects: rows.stageEffects
        .filter((effect) => effect.distortionId === id)
        .map((effect) => {
          const effectStageId = required(effect.stageId, `${id}.stageEffects.stageId`);
          const intensity = clean(effect.intensity) || "medium";
          if (effectStageId && !stageIds.has(effectStageId)) {
            errors.push(`Неизвестный stageId "${effectStageId}" в stageEffects для "${id}"`);
          }
          if (!allowedIntensity.has(intensity)) {
            errors.push(`Неизвестная intensity "${intensity}" в stageEffects для "${id}"`);
          }
          return {
            stageId: effectStageId,
            effect: required(effect.effect, `${id}.stageEffects.effect`),
            intensity,
          };
        }),
      roleEffects: rows.roleEffects
        .filter((effect) => effect.distortionId === id)
        .map((effect) => {
          const effectRoleId = required(effect.roleId, `${id}.roleEffects.roleId`);
          if (effectRoleId && !roleIds.has(effectRoleId)) {
            errors.push(`Неизвестный roleId "${effectRoleId}" в roleEffects для "${id}"`);
          }
          return {
            roleId: effectRoleId,
            effect: required(effect.effect, `${id}.roleEffects.effect`),
          };
        }),
      finalConclusion: clean(distortion.finalConclusion),
      sourceNotes: rows.sources
        .filter((source) => source.distortionId === id)
        .map((source) => {
          const status = clean(source.status) || "placeholder";
          if (!allowedSourceStatus.has(status)) {
            errors.push(`Неизвестный source status "${status}" для "${id}"`);
          }
          return {
            title: required(source.title, `${id}.sources.title`),
            status,
            url: clean(source.url),
            notes: clean(source.notes),
          };
        }),
    };
  }),
};

for (const collection of ["stageEffects", "roleEffects", "sources"]) {
  for (const row of rows[collection]) {
    if (row.distortionId && !distortionIds.has(row.distortionId)) {
      errors.push(`Вкладка ${collection}: ссылка на неизвестный distortionId "${row.distortionId}"`);
    }
  }
}

if (errors.length > 0) {
  await fs.writeFile(path.join(outputDir, "import-errors.json"), JSON.stringify(errors, null, 2), "utf8");
  throw new Error(`Импорт остановлен: ${errors.length} ошибок. См. outputs/stasia-import/import-errors.json`);
}

await fs.writeFile(rowsOutputPath, JSON.stringify(rows, null, 2), "utf8");
await fs.writeFile(modelPreviewPath, JSON.stringify(model, null, 2), "utf8");
await fs.writeFile(modelOutputPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  roles: rows.roles.length,
  stages: rows.stages.length,
  distortions: rows.distortions.length,
  stageEffects: rows.stageEffects.length,
  roleEffects: rows.roleEffects.length,
  sources: rows.sources.length,
  modelOutputPath,
  rowsOutputPath,
}, null, 2));
