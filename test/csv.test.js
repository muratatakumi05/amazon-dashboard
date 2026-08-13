import test from "node:test";
import assert from "node:assert/strict";
import { aggregateAds, aggregateSales, normalizeHeader, parseCsv, parseNumber } from "../src/csv.js";
import { calculateMetrics, dashboardDisplay, formatMetrics } from "../src/metrics.js";

test("日本語 Business Report の通貨とカンマを合計する", () => {
  const csv = '\ufeff日付,注文商品売上,注文数\r\n2026/08/01,"￥12,345",2\r\n2026/08/02,¥5,1';
  assert.deepEqual(aggregateSales(csv), { total: 12350, rows: 2, header: "注文商品売上", period: { start: "2026-08-01", end: "2026-08-02" } });
});

test("日本語 Sponsored Products の標準ヘッダーを読み込む", () => {
  const csv = '開始日,終了日,キャンペーン名,費用,7日間の合計売上\n2026/08/01,2026/08/01,広告A,"￥1,200","￥4,800"\n2026/08/02,2026/08/02,広告B,300,900';
  assert.deepEqual(aggregateAds(csv), { spend: 1500, sales: 5700, rows: 2, spendHeader: "費用", salesHeader: "7日間の合計売上", period: { start: "2026-08-01", end: "2026-08-02" } });
});

test("実広告CSVの7日間総売上高を合計しROAS・ACOSを合計値から再計算する", () => {
  const csv = [
    "日付,広告費,広告費売上高比率（ACOS）合計,広告費用対効果（ROAS）合計,広告がクリックされてから7日間の総売上高",
    '2026/08/01,"1,000",10%,10,"10,000"',
    '2026/08/02,"3,000",50%,2,"6,000"'
  ].join("\n");
  const ads = aggregateAds(csv);

  assert.deepEqual(ads, {
    spend: 4000,
    sales: 16000,
    rows: 2,
    spendHeader: "広告費",
    salesHeader: "広告がクリックされてから7日間の総売上高",
    period: { start: "2026-08-01", end: "2026-08-02" }
  });
  assert.deepEqual(calculateMetrics(20000, ads.spend, ads.sales), {
    totalSales: 20000,
    adSpend: 4000,
    adSales: 16000,
    roas: 4,
    acos: 25,
    tacos: 20
  });
});

test("14日間の日本語広告売上ヘッダーと全角文字に対応する", () => {
  const csv = 'キャンペーン名\t費 用\t１４日間の合計売上\nA\t１０００\t２５００';
  assert.equal(aggregateAds(csv).sales, 2500);
});

test("日本語広告レポートの「売上高」「総費用」という表記も読み込む", () => {
  const csv = 'キャンペーン名,総費用,7日間の合計売上高\n広告A,"¥2,000","¥8,000"';
  assert.deepEqual(aggregateAds(csv), { spend: 2000, sales: 8000, rows: 1, spendHeader: "総費用", salesHeader: "7日間の合計売上高", period: null });
});

test("英語ヘッダー、引用符内改行、エスケープ引用符を解析する", () => {
  const parsed = parseCsv('Campaign,Spend,Sales\n"A\n""special""",10,20');
  assert.equal(parsed.rows[0].Campaign, 'A\n"special"');
  assert.deepEqual(aggregateAds('Campaign,Spend,Sales\nA,10,20'), { spend: 10, sales: 20, rows: 1, spendHeader: "Spend", salesHeader: "Sales", period: null });
});

test("金額文字列とヘッダーを安全に正規化する", () => {
  assert.equal(parseNumber("(¥1,234.50)"), -1234.5);
  assert.equal(parseNumber("--"), 0);
  assert.equal(normalizeHeader(" ７日間の 合計売上（円） "), "7日間の合計売上");
});

test("正しい ROAS、ACOS、TACoS を計算する", () => {
  assert.deepEqual(calculateMetrics(10000, 1000, 4000), { totalSales: 10000, adSpend: 1000, adSales: 4000, roas: 4, acos: 25, tacos: 10 });
  assert.equal(calculateMetrics(0, 0, 0).roas, null);
  assert.equal(calculateMetrics(0, 0, 0).acos, null);
  assert.equal(calculateMetrics(0, 0, 0).tacos, null);
});

test("CSV集計結果を画面と同じ形式で表示する", () => {
  const sales = aggregateSales('日付,注文商品売上\n2026/08/01,"¥120,000"\n2026/08/02,"¥30,000"');
  const ads = aggregateAds('開始日,費用,7日間の合計売上\n2026/08/01,"¥10,000","¥40,000"\n2026/08/02,"¥5,000","¥20,000"');
  assert.deepEqual(formatMetrics(calculateMetrics(sales.total, ads.spend, ads.sales)), {
    totalSales: "￥150,000", adSpend: "￥15,000", adSales: "￥60,000", roas: "4.00x", acos: "25.0%", tacos: "10.0%"
  });
});

test("CSV未読込時は0や架空値ではなく未読込と表示する", () => {
  assert.deepEqual(dashboardDisplay(calculateMetrics(0, 0, 0)), {
    totalSales: "未読込", adSpend: "未読込", adSales: "未読込", roas: "未読込", acos: "未読込", tacos: "未読込"
  });
  assert.equal(dashboardDisplay(calculateMetrics(1000, 0, 0), { salesLoaded: true }).totalSales, "￥1,000");
  assert.equal(dashboardDisplay(calculateMetrics(1000, 0, 0), { salesLoaded: true }).tacos, "未読込");
});

test("データ行がないCSVを売上0として扱わない", () => {
  assert.throws(() => aggregateSales("日付,注文商品売上\n"), /データ行/);
});

test("実データ中の不正な金額を黙って0として集計しない", () => {
  assert.throws(() => aggregateAds("開始日,費用,売上\n8/1,読取不能,1000"), /2行目.*費用.*読取不能/);
});

test("必須列がない CSV は明示的なエラーにする", () => {
  assert.throws(() => aggregateAds("クリック数,表示回数\n1,2"), /広告費/);
});
