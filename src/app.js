import { aggregateAds, aggregateSales, decodeFile } from "./csv.js";
import { calculateMetrics, dashboardDisplay } from "./metrics.js";

const state = { totalSales: 0, adSpend: 0, adSales: 0, salesLoaded: false, adsLoaded: false };
const elements = Object.fromEntries(["total-sales", "ad-spend", "ad-sales", "roas", "acos", "tacos", "data-state", "error-box"].map(id => [id, document.getElementById(id)]));

function render() {
  const result = calculateMetrics(state.totalSales, state.adSpend, state.adSales);
  const display = dashboardDisplay(result, state);
  elements["total-sales"].textContent = display.totalSales;
  elements["ad-spend"].textContent = display.adSpend;
  elements["ad-sales"].textContent = display.adSales;
  elements.roas.textContent = display.roas;
  elements.acos.textContent = display.acos;
  elements.tacos.textContent = display.tacos;
  const count = Number(state.salesLoaded) + Number(state.adsLoaded);
  elements["data-state"].textContent = count === 2 ? "✓ 2つのCSVから集計完了" : count ? `あと${2 - count}つのCSVをアップロードしてください` : "2つのCSVをアップロードしてください";
}

function showError(message) {
  elements["error-box"].hidden = false;
  elements["error-box"].textContent = message;
}

async function load(kind, file) {
  const status = document.getElementById(`${kind}-status`);
  const card = document.getElementById(`${kind}-card`);
  elements["error-box"].hidden = true;
  status.textContent = `${file.name} を読み込んでいます…`;
  try {
    const text = await decodeFile(file);
    if (kind === "sales") {
      const result = aggregateSales(text);
      state.totalSales = result.total; state.salesLoaded = true;
      status.textContent = `✓ ${file.name}（${result.rows.toLocaleString()}行）`;
    } else {
      const result = aggregateAds(text);
      state.adSpend = result.spend; state.adSales = result.sales; state.adsLoaded = true;
      status.textContent = `✓ ${file.name}（${result.rows.toLocaleString()}行）`;
    }
    card.classList.add("loaded");
    render();
  } catch (error) {
    if (kind === "sales") {
      state.totalSales = 0;
      state.salesLoaded = false;
    } else {
      state.adSpend = 0;
      state.adSales = 0;
      state.adsLoaded = false;
    }
    status.textContent = `読み込み失敗: ${file.name}`;
    card.classList.remove("loaded");
    showError(error instanceof Error ? error.message : "CSVを読み込めませんでした。");
    render();
  }
}

document.getElementById("sales-file").addEventListener("change", event => event.target.files[0] && load("sales", event.target.files[0]));
document.getElementById("ads-file").addEventListener("change", event => event.target.files[0] && load("ads", event.target.files[0]));
render();
