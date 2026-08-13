const SALES_HEADERS = ["注文商品売上", "注文商品売上高", "注文された商品売上", "注文された商品売上高", "商品売上", "商品売上高", "orderedproductsales", "orderedsales"];
const SPEND_HEADERS = ["費用", "総費用", "広告費", "広告費用", "支出", "spend", "cost"];
const AD_SALES_HEADERS = [
  "広告がクリックされてから7日間の総売上高",
  "7日間の合計売上", "7日間の合計売上高", "7日間の合計売上額", "14日間の合計売上", "14日間の合計売上高", "14日間の合計売上額",
  "30日間の合計売上", "30日間の合計売上高", "30日間の合計売上額", "合計売上", "合計売上高", "合計売上額",
  "広告売上", "広告売上高", "広告売上額", "売上", "売上高", "売上額",
  "7daytotalsales", "14daytotalsales", "30daytotalsales", "sales", "advertisingsales"
];
const SALES_DATE_HEADERS = ["日付", "date"];
const ADS_START_DATE_HEADERS = ["日付", "開始日", "startdate", "date"];
const ADS_END_DATE_HEADERS = ["終了日", "enddate"];

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

function parseAmount(value, column, rowNumber) {
  const text = String(value ?? "").normalize("NFKC").trim();
  if (!text || text === "--" || text === "-") return 0;
  const amount = parseNumber(text);
  const cleaned = text.replace(/[¥￥$€£,%\s,()]/g, "");
  if (!cleaned || !Number.isFinite(Number(cleaned))) {
    throw new Error(`${rowNumber}行目の「${column}」を金額として読み取れません: ${text}`);
  }
  return amount;
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

function parseDate(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim()
    .replace(/年|月/g, "/").replace(/日/g, "").replace(/[.-]/g, "/");
  const parts = normalized.split("/").map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) return null;
  const [first, second, third] = parts;
  const [year, month, day] = first > 31 ? [first, second, third] : [third, first, second];
  const date = new Date(Date.UTC(year < 100 ? year + 2000 : year, month - 1, day));
  return date.getUTCFullYear() === (year < 100 ? year + 2000 : year) && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

function dateRange(parsed, startCandidates, endCandidates = startCandidates) {
  const startHeader = findHeader(parsed.headers, startCandidates);
  const endHeader = findHeader(parsed.headers, endCandidates) ?? startHeader;
  if (!startHeader || !endHeader) return null;
  const dates = parsed.rows.flatMap(row => [parseDate(row[startHeader]), parseDate(row[endHeader])]).filter(Boolean).sort();
  return dates.length ? { start: dates[0], end: dates.at(-1) } : null;
}

function sumColumn(parsed, candidates, label) {
  const header = findHeader(parsed.headers, candidates);
  if (!header) throw new Error(`${label}の列が見つかりません。検出した列: ${parsed.headers.join(" / ")}`);
  if (!parsed.rows.length) throw new Error("CSVに集計対象のデータ行がありません。");
  return { total: parsed.rows.reduce((sum, row, index) => sum + parseAmount(row[header], header, index + 2), 0), rows: parsed.rows.length, header };
}

export function aggregateSales(text) {
  const parsed = parseCsv(text);
  return { ...sumColumn(parsed, SALES_HEADERS, "注文商品売上"), period: dateRange(parsed, SALES_DATE_HEADERS) };
}

export function aggregateAds(text) {
  const parsed = parseCsv(text);
  const spend = sumColumn(parsed, SPEND_HEADERS, "広告費（費用）");
  const sales = sumColumn(parsed, AD_SALES_HEADERS, "広告売上");
  return {
    spend: spend.total, sales: sales.total, rows: parsed.rows.length,
    spendHeader: spend.header, salesHeader: sales.header,
    period: dateRange(parsed, ADS_START_DATE_HEADERS, ADS_END_DATE_HEADERS)
  };
}

export async function decodeFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  try { return utf8.decode(bytes); }
  catch { return new TextDecoder("shift_jis").decode(bytes); }
}
