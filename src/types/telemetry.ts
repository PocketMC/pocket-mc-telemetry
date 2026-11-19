export type DistributionMap = Record<string, number>;

export interface TelemetryStats {
  totalInstalls: number;
  activeUsers7d?: number;
  inactiveUsers7d?: number;
  activeUsers30d?: number;
  activeUsers24h?: number;
  openClients?: number;
  activeUsers?: number;
  totalRunningServers?: number;
  globalUptimeHours?: number;
  totalServersCreated?: number;
  totalServersDeleted?: number;
  installVersionDistribution?: DistributionMap;
  installLocationDistribution?: DistributionMap;
  serverTypeDistribution?: DistributionMap;
  versionDistribution?: DistributionMap;
  locationDistribution?: DistributionMap;
  _telemetry?: {
    totalProxies: number;
    onlineProxies: number;
    offlineProxies: number;
  };
}

export type TimeframePeriod = '7d' | '24h' | '30d' | 'total';

export interface TelemetryState {
  data: TelemetryStats | null;
  loading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  refresh: () => Promise<void>;
}
