export function calculateMetrics(totalSales = 0, adSpend = 0, adSales = 0) {
  return {
    totalSales,
    adSpend,
    adSales,
    roas: adSpend > 0 ? adSales / adSpend : null,
    acos: adSales > 0 ? (adSpend / adSales) * 100 : null,
    tacos: totalSales > 0 ? (adSpend / totalSales) * 100 : null
  };
}

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

export function formatMetrics(metrics) {
  return {
    totalSales: yen.format(metrics.totalSales),
    adSpend: yen.format(metrics.adSpend),
    adSales: yen.format(metrics.adSales),
    roas: metrics.roas == null ? "—" : `${metrics.roas.toFixed(2)}x`,
    acos: metrics.acos == null ? "—" : `${metrics.acos.toFixed(1)}%`,
    tacos: metrics.tacos == null ? "—" : `${metrics.tacos.toFixed(1)}%`
  };
}

export function dashboardDisplay(metrics, { salesLoaded = false, adsLoaded = false } = {}) {
  const display = formatMetrics(metrics);
  return {
    totalSales: salesLoaded ? display.totalSales : "未読込",
    adSpend: adsLoaded ? display.adSpend : "未読込",
    adSales: adsLoaded ? display.adSales : "未読込",
    roas: adsLoaded ? display.roas : "未読込",
    acos: adsLoaded ? display.acos : "未読込",
    tacos: salesLoaded && adsLoaded ? display.tacos : "未読込"
  };
}
