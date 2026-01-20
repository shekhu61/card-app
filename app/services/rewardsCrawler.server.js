let isRunning = false;
let lastRunAt = 0;

const INTERVAL = 5 * 60 * 1000; // 5 minutes

// shared status object (single source of truth)
let history = [];

export function getCrawlerStatus() {
  return {
    isRunning,
    lastRunAt,
    nextRunAt: lastRunAt ? lastRunAt + INTERVAL : Date.now() + INTERVAL,
    history,
  };
}

export async function runRewardsCrawlerIfDue(runFn) {
  const now = Date.now();

  if (isRunning) {
    return { skipped: true, reason: "already_running" };
  }

  if (lastRunAt && now - lastRunAt < INTERVAL) {
    return { skipped: true, reason: "not_due" };
  }

  isRunning = true;

  try {
    const result = await runFn();

    lastRunAt = Date.now();

    history.unshift({
      time: new Date(lastRunAt).toLocaleTimeString(),
      status: "Success",
      totalEmployees: result.totalEmployees,
      processed: result.totalProcessed,
    });

    history = history.slice(0, 20);

    return result;
  } catch (err) {
    history.unshift({
      time: new Date().toLocaleTimeString(),
      status: "Failed",
      totalEmployees: "-",
      processed: "-",
    });

    throw err;
  } finally {
    isRunning = false;
  }
}
