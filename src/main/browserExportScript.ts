/** Source of the actual local converter exported into each workflow revision. */
export function browserExportScript(csvModule: string, excelModule: string): string {
 return `// Ghost local file converter. No cloud requests or Ghost runtime adapter.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { parse } from ${JSON.stringify(csvModule)};
import ExcelJS from ${JSON.stringify(excelModule)};

async function checkSize(path) {
  if ((await stat(path)).size > 2_000_000) throw new Error('Input exceeds 2 MB: ' + path);
}
async function readCSV(path) {
  await checkSize(path);
  const text = await readFile(path, 'utf8');
  const rows = parse(text, { columns: true, bom: true, skip_empty_lines: true, max_record_size: 20000 });
  if (rows.length > 10000) throw new Error('CSV exceeds 10000 rows.');
  return rows;
}
async function readExcel(path) {
  if (!path) return null;
  await checkSize(path);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path);
  let count = 0;
  const sheets = book.worksheets.map(sheet => {
    const rows = [];
    sheet.eachRow(row => {
      if (++count > 10000 || row.cellCount > 200) throw new Error('Workbook exceeds row or column limits.');
      const cells = [];
      for (let column = 1; column <= row.cellCount; column++) cells.push(row.getCell(column).text);
      rows.push(cells);
    });
    return { name: sheet.name, rows };
  });
  return { filename: 'nova-shopping-list.xlsx', sheets };
}

// Ghost supplies actual paths from the preceding browser node's verified run.
// This function also works directly in Node.js with the same input object.
export async function run({ salesPath, inventoryPath, workbookPath, outputPath, browserRunId, sourceFiles = [] }) {
  if (!salesPath || !inventoryPath || !outputPath) throw new Error('Sales, inventory and output paths are required.');
  const sales = await readCSV(salesPath);
  const inventory = await readCSV(inventoryPath);
  const workbook = await readExcel(workbookPath);
  const output = { browserRunId, sourceFiles, data: { sales, inventory, workbook } };
  await writeFile(outputPath, JSON.stringify(output, null, 2), { mode: 0o600, flag: 'wx' });
  return output;
}
`;
}
