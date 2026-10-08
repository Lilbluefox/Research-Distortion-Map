import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SpreadsheetFile,
  Workbook,
} from "file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "outputs");
const outputPath = path.join(outputDir, "stasia-research-distortion-data.xlsx");
const dataPath = path.join(rootDir, "src", "data", "modelData.json");

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const workbook = Workbook.create();
const font = "Arial";

const sheets = {
  guide: workbook.worksheets.add("Инструкция"),
  roles: workbook.worksheets.add("Классы"),
  stages: workbook.worksheets.add("Среды"),
  distortions: workbook.worksheets.add("Искажения"),
  stageEffects: workbook.worksheets.add("Эффекты по средам"),
  roleEffects: workbook.worksheets.add("Эффекты по классам"),
  sources: workbook.worksheets.add("Источники"),
};

function writeTable(sheet, startCell, headers, rows, widths = []) {
  const matrix = [headers, ...rows];
  const rowCount = matrix.length;
  const colCount = headers.length;
  const range = sheet.getRange(startCell).resize(rowCount, colCount);
  range.values = matrix;
  range.format.font = { name: font, size: 10, color: "#202124" };
  range.format.wrapText = true;
  range.format.verticalAlignment = "top";
  range.format.borders = { preset: "all", style: "thin", color: "#DADCE0" };

  const headerRange = sheet.getRange(startCell).resize(1, colCount);
  headerRange.format = {
    fill: "#F1F3F4",
    font: { name: font, size: 10, bold: true, color: "#202124" },
    verticalAlignment: "center",
  };

  widths.forEach((width, index) => {
    if (width) {
      sheet.getRangeByIndexes(0, index, rowCount, 1).format.columnWidthPx = width;
    }
  });

  sheet.freezePanes.freezeRows(1);
  return range;
}

function setTabBasics(sheet) {
  sheet.showGridLines = true;
}

Object.values(sheets).forEach(setTabBasics);

sheets.guide.getRange("A1:D1").values = [["Как заполнять модель", "", "", ""]];
sheets.guide.getRange("A1:D1").format = {
  font: { name: font, size: 14, bold: true, color: "#202124" },
};
sheets.guide.getRange("A3:D10").values = [
  ["Шаг", "Что заполнять", "Где", "Важно"],
  ["1", "Добавить класс, если нужен новый участник модели", "Классы", "ID пишется латиницей без пробелов."],
  ["2", "Добавить среду или этап", "Среды", "order задает порядок слева направо."],
  ["3", "Добавить само искажение", "Искажения", "roleId и stageId должны совпадать с ID из вкладок Классы и Среды."],
  ["4", "Описать заражение этапов", "Эффекты по средам", "Одна строка = один эффект на одном этапе."],
  ["5", "Описать последствия для классов", "Эффекты по классам", "Одна строка = один эффект для одного класса."],
  ["6", "Добавить научные источники", "Источники", "URL можно оставить пустым, пока источник не найден."],
  ["7", "После заполнения обновить JSON модели", "Проект", "Скрипт синхронизации будет собирать данные по ID."],
];
sheets.guide.getRange("A3:D10").format.font = { name: font, size: 10, color: "#202124" };
sheets.guide.getRange("A3:D3").format = {
  fill: "#F1F3F4",
  font: { name: font, size: 10, bold: true, color: "#202124" },
};
sheets.guide.getRange("A3:D10").format.borders = { preset: "all", style: "thin", color: "#DADCE0" };
[70, 220, 170, 360].forEach((width, index) => {
  sheets.guide.getRangeByIndexes(0, index, 10, 1).format.columnWidthPx = width;
});
sheets.guide.freezePanes.freezeRows(3);

writeTable(
  sheets.roles,
  "A1",
  ["roleId", "title", "shortTitle", "description"],
  data.roles.map((role) => [role.id, role.title, role.shortTitle, role.description]),
  [150, 160, 160, 520],
);

writeTable(
  sheets.stages,
  "A1",
  ["stageId", "title", "shortTitle", "order", "description"],
  data.stages.map((stage) => [stage.id, stage.title, stage.shortTitle, stage.order, stage.description]),
  [150, 220, 150, 80, 520],
);
sheets.stages.getRange("D2:D100").format.numberFormat = "0";

writeTable(
  sheets.distortions,
  "A1",
  ["distortionId", "title", "roleId", "stageId", "label", "summary", "mechanism", "finalConclusion"],
  data.distortions.map((distortion) => [
    distortion.id,
    distortion.title,
    distortion.roleId,
    distortion.stageId,
    distortion.label,
    distortion.summary,
    distortion.mechanism,
    distortion.finalConclusion,
  ]),
  [230, 300, 140, 150, 70, 420, 460, 460],
);

writeTable(
  sheets.stageEffects,
  "A1",
  ["distortionId", "stageId", "intensity", "effect"],
  data.distortions.flatMap((distortion) =>
    distortion.stageEffects.map((effect) => [
      distortion.id,
      effect.stageId,
      effect.intensity,
      effect.effect,
    ]),
  ),
  [250, 150, 110, 560],
);

writeTable(
  sheets.roleEffects,
  "A1",
  ["distortionId", "roleId", "effect"],
  data.distortions.flatMap((distortion) =>
    distortion.roleEffects.map((effect) => [distortion.id, effect.roleId, effect.effect]),
  ),
  [250, 140, 620],
);

writeTable(
  sheets.sources,
  "A1",
  ["distortionId", "title", "status", "url", "notes"],
  data.distortions.flatMap((distortion) =>
    distortion.sourceNotes.map((source) => [distortion.id, source.title, source.status, "", ""]),
  ),
  [250, 430, 130, 320, 320],
);

for (const sheet of Object.values(sheets)) {
  const usedRange = sheet.getUsedRange();
  if (usedRange) {
    usedRange.format.font = { name: font, size: 10, color: "#202124" };
    usedRange.format.verticalAlignment = "top";
  }
}

const preview = await workbook.render({
  sheetName: "Искажения",
  range: "A1:H8",
  scale: 1,
  format: "png",
});

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "stasia-research-distortion-data-preview.png"), new Uint8Array(await preview.arrayBuffer()));

const inspect = await workbook.inspect({
  kind: "workbook,sheet",
  maxChars: 5000,
});
console.log(inspect.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
