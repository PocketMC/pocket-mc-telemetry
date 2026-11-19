import { TelemetryStats, DistributionMap } from '../types/telemetry';

export const TELEMETRY_PROXIES = [
  'https://pocket-mc-proxy.onrender.com/api/telemetry/stats',
];

export const DISCORD_BOT_KEEP_ALIVE_URL =
  'https://pocketmc-welcome-bot-1e5d.onrender.com/health';

const GLOBAL_METRIC_DEFAULTS: Partial<TelemetryStats> = {
  totalInstalls: 0,
  installVersionDistribution: {},
  installLocationDistribution: {},
  globalUptimeHours: 0,
  totalServersCreated: 0,
  totalServersDeleted: 0,
};

const LIVE_METRIC_FIELDS: (keyof TelemetryStats)[] = [
  'openClients',
  'activeUsers',
  'totalRunningServers',
];

const LIVE_DISTRIBUTION_FIELDS: (keyof TelemetryStats)[] = [
  'serverTypeDistribution',
  'versionDistribution',
  'locationDistribution',
];

function toNumber(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function addDistribution(target: DistributionMap, source: DistributionMap | undefined) {
  if (!source) return;
  for (const [k, v] of Object.entries(source)) {
    target[k] = (target[k] || 0) + toNumber(v);
  }
}

export function aggregateTelemetry(
  proxyResults: PromiseSettledResult<Partial<TelemetryStats>>[],
  totalProxies: number
): TelemetryStats {
  const responses = proxyResults
    .filter(
      (res): res is PromiseFulfilledResult<Partial<TelemetryStats>> =>
        res.status === 'fulfilled' &&
        res.value !== undefined &&
        (res.value.totalInstalls !== undefined || res.value.openClients !== undefined)
    )
    .map((r) => r.value);

  if (!responses.length) {
    throw new Error('All telemetry proxies are offline or unreachable');
  }

  const primary = responses[0];
  const aggregated: TelemetryStats = {
    ...GLOBAL_METRIC_DEFAULTS,
    ...primary,
    totalInstalls: toNumber(primary.totalInstalls),
    _telemetry: {
      totalProxies,
      onlineProxies: responses.length,
      offlineProxies: totalProxies - responses.length,
    },
  };

  // Windowed metrics
  const windowFields: (keyof TelemetryStats)[] = [
    'activeUsers7d',
    'inactiveUsers7d',
    'activeUsers30d',
    'activeUsers24h',
  ];
  for (const field of windowFields) {
    const found = responses.map((r) => r[field]).find((v) => v !== undefined && v !== null);
    if (found !== undefined) {
      (aggregated as any)[field] = toNumber(found);
    }
  }

  // Sum live concurrency counts
  for (const field of LIVE_METRIC_FIELDS) {
    (aggregated as any)[field] = responses.reduce((acc, curr) => acc + toNumber(curr[field]), 0);
  }

  // Merge live distributions
  for (const field of LIVE_DISTRIBUTION_FIELDS) {
    aggregated[field] = {};
    for (const r of responses) {
      addDistribution(aggregated[field]!, r[field] as DistributionMap);
    }
  }

  return aggregated;
}

async function fetchProxy(url: string, timeoutMs = 15000): Promise<Partial<TelemetryStats>> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

export async function fetchAggregatedStats(): Promise<TelemetryStats> {
  const urls = TELEMETRY_PROXIES.map((u) => u.trim()).filter(Boolean);
  if (!urls.length) throw new Error('No proxy URLs configured');

  const results = await Promise.allSettled(urls.map((u) => fetchProxy(u)));
  return aggregateTelemetry(results, urls.length);
}
