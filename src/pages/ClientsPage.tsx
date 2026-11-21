import React from 'react';
import { Activity, Users, TrendingUp, Globe } from 'lucide-react';
import { TelemetryStats } from '../types/telemetry';
import { SectionCard } from '../components/SectionCard';
import { KpiCard } from '../components/KpiCard';
import { BreakdownCard } from '../components/BreakdownCard';

interface ClientsPageProps {
  data: TelemetryStats | null;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ data }) => {
  const fmt = (n?: number | null) => (n == null ? '-' : n.toLocaleString());
  const activeCountries = Object.keys(data?.locationDistribution || {}).length;

  return (
    <SectionCard
      id="section-clients"
      title="Active Clients & Online Population"
      icon={<Activity size={18} />}
      iconColor="blue"
      insight={
        <span>
          <strong>{fmt(data?.openClients)}</strong> clients currently online running PocketMC
        </span>
      }
    >
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <KpiCard
          value={fmt(data?.openClients)}
          label="Open Clients Now"
          colorClass="text-blue"
          icon={<Activity size={18} />}
          tooltip="Connected clients sending live telemetry heartbeat"
        />
        <KpiCard
          value={fmt(data?.activeUsers7d)}
          label="Active Users (7D)"
          colorClass="text-blue"
          icon={<Users size={18} />}
          tooltip="Distinct active user sessions in the last 7 days"
        />
        <KpiCard
          value={fmt(data?.openClients)}
          label="Peak Concurrent"
          colorClass="text-slate"
          icon={<TrendingUp size={18} />}
          tooltip="Live concurrent client peak observed"
        />
        <KpiCard
          value={fmt(activeCountries)}
          label="Active Countries"
          colorClass="text-blue"
          icon={<Globe size={18} />}
          tooltip="Countries with currently active clients"
        />
      </div>

      {/* Distribution Breakdowns Grid */}
      <div className="breakdown-grid">
        <BreakdownCard
          title="Active Client Versions"
          data={data?.versionDistribution}
        />
        <BreakdownCard
          title="Active Client Locations"
          data={data?.locationDistribution}
          isCountry
        />
      </div>
    </SectionCard>
  );
};
