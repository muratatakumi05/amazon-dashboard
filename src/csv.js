const SALES_HEADERS = ["注文商品売上", "注文商品売上高", "注文された商品売上", "注文された商品売上高", "商品売上", "商品売上高", "orderedproductsales", "orderedsales"];
const SPEND_HEADERS = ["費用", "総費用", "広告費", "広告費用", "支出", "spend", "cost"];
const AD_SALES_HEADERS = [
  "7日間の合計売上", "7日間の合計売上高", "7日間の合計売上額", "14日間の合計売上", "14日間の合計売上高", "14日間の合計売上額",
  "30日間の合計売上", "30日間の合計売上高", "30日間の合計売上額", "合計売上", "合計売上高", "合計売上額",
  "広告売上", "広告売上高", "広告売上額", "売上", "売上高", "売上額",
  "7daytotalsales", "14daytotalsales", "30daytotalsales", "sales", "advertisingsales"
];

export function normalizeHeader(value) {
  return String(value ?? "").replace(/^\ufeff/, "").normalize("NFKC").toLowerCase()
    .replace(/[\s_\-()（）:：\/¥￥$]/g, "").replace(/(?:jpy|円)$/g, "");
}

export function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").normalize("NFKC").trim();
  if (!text || text === "--" || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[¥￥$€£,%\s,()]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? (negative ? -number : number) : 0;
}

function detectDelimiter(firstLine) {
  const counts = [",", "\t", ";"].map(delimiter => ({ delimiter, count: firstLine.split(delimiter).length }));
  return counts.sort((a, b) => b.count - a.count)[0].delimiter;
}

export function parseCsv(text) {
  const source = String(text).replace(/^\ufeff/, "");
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0]);
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); if (row.some(cell => cell.trim())) rows.push(row); row = []; field = ""; }
    else field += character;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some(cell => cell.trim())) rows.push(row);
  if (!rows.length) throw new Error("CSVにデータがありません。");
  const headers = rows[0].map(cell => cell.trim());
  return { headers, rows: rows.slice(1).map(values => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]))) };
}

function findHeader(headers, candidates) {
  const wanted = new Set(candidates.map(normalizeHeader));
  return headers.find(header => wanted.has(normalizeHeader(header)));
}

function sumColumn(parsed, candidates, label) {
  const header = findHeader(parsed.headers, candidates);
  if (!header) throw new Error(`${label}の列が見つかりません。検出した列: ${parsed.headers.join(" / ")}`);
  if (!parsed.rows.length) throw new Error("CSVに集計対象のデータ行がありません。");
  return { total: parsed.rows.reduce((sum, row) => sum + parseNumber(row[header]), 0), rows: parsed.rows.length, header };
}

export function aggregateSales(text) {
  return sumColumn(parseCsv(text), SALES_HEADERS, "注文商品売上");
}

export function aggregateAds(text) {
  const parsed = parseCsv(text);
  const spend = sumColumn(parsed, SPEND_HEADERS, "広告費（費用）");
  const sales = sumColumn(parsed, AD_SALES_HEADERS, "広告売上");
  return { spend: spend.total, sales: sales.total, rows: parsed.rows.length, spendHeader: spend.header, salesHeader: sales.header };
}

export async function decodeFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  try { return utf8.decode(bytes); }
  catch { return new TextDecoder("shift_jis").decode(bytes); }
}
