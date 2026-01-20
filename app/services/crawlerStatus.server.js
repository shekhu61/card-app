let isRunning = false;
let lastRunAt = 0;
let nextRunAt = Date.now();
let history = [];

const CRAWL_INTERVAL = 3 * 60 * 1000;

/* =========================
   CALLED BY CRAWLER
========================= */
export function markCrawlStart() {
  isRunning = true;
}

export function markCrawlEnd(result) {
  isRunning = false;
  lastRunAt = Date.now();
  nextRunAt = lastRunAt + CRAWL_INTERVAL;

  history.unshift({
    time: new Date(lastRunAt).toLocaleTimeString(),
    status: result?.success ? "Success" : "Failed",
    totalEmployees: result?.totalEmployees ?? "-",
    processed: result?.totalProcessed ?? "-",
  });

  // Keep last 20 only
  history = history.slice(0, 20);
}

/* =========================
   UI READS THIS
========================= */
export function getCrawlerStatus() {
  return {
    isRunning,
    lastRunAt,
    nextRunAt,
    history,
  };
}

/* =========================
   SAFETY (for restarts)
========================= */
export function ensureNextRunAt() {
  if (!lastRunAt) {
    nextRunAt = Date.now() + CRAWL_INTERVAL;
  }
}
