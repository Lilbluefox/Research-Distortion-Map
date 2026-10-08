import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const sourcePath = "C:/Users/user/Downloads/Telegram Desktop/Данные_интерактивной_модели_искажений.xlsx";
const outDir = path.resolve("outputs", "stasia-import");

await fs.mkdir(outDir, { recursive: true });

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 20000,
  tableMaxRows: 12,
  tableMaxCols: 12,
  tableMaxCellChars: 220,
});

await fs.writeFile(path.join(outDir, "inspect.ndjson"), summary.ndjson, "utf8");
console.log(summary.ndjson);
