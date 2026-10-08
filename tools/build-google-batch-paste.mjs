import fs from "node:fs/promises";
import path from "node:path";

const rowsPath = path.resolve("outputs", "stasia-import", "normalized-rows.json");
const outputPath = path.resolve("outputs", "stasia-import", "google-batch-paste.json");

const rows = JSON.parse(await fs.readFile(rowsPath, "utf8"));

const tabs = [
  {
    key: "roles",
    sheetId: 657088651,
    columns: ["roleId", "title", "shortTitle", "description"],
  },
  {
    key: "stages",
    sheetId: 1432575977,
    columns: ["stageId", "title", "shortTitle", "order", "description"],
  },
  {
    key: "distortions",
    sheetId: 546020161,
    columns: ["distortionId", "title", "roleId", "stageId", "label", "summary", "mechanism", "finalConclusion"],
  },
  {
    key: "stageEffects",
    sheetId: 327262294,
    columns: ["distortionId", "stageId", "intensity", "effect"],
  },
  {
    key: "roleEffects",
    sheetId: 1398521076,
    columns: ["distortionId", "roleId", "effect"],
  },
  {
    key: "sources",
    sheetId: 189642991,
    columns: ["distortionId", "title", "status", "url", "notes"],
  },
];

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toCsv(columns, tableRows) {
  return [
    columns.map(csvCell).join(","),
    ...tableRows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

const requests = tabs.map((tab) => ({
  pasteData: {
    coordinate: {
      sheetId: tab.sheetId,
      rowIndex: 0,
      columnIndex: 0,
    },
    data: toCsv(tab.columns, rows[tab.key]),
    type: "PASTE_NORMAL",
    delimiter: ",",
  },
}));

await fs.writeFile(outputPath, JSON.stringify({ requests }, null, 2), "utf8");

console.log(JSON.stringify({
  outputPath,
  requestCount: requests.length,
  rowCounts: Object.fromEntries(tabs.map((tab) => [tab.key, rows[tab.key].length + 1])),
}, null, 2));
