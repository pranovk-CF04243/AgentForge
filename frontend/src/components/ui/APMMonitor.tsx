import React from 'react';
import { useStore } from '../../store/useStore';
import { Activity, Server, Cpu, Database, Network, ShieldCheck, Zap } from 'lucide-react';

export const APMMonitor: React.FC = () => {
  const metrics = useStore((state) => state.metrics);

  const services = [
    { name: 'los-gateway-service', pods: '4/4 Ready', cpu: '28%', mem: '512Mi', status: 'HEALTHY' },
    { name: 'underwriting-worker-pool', pods: '12/12 Ready', cpu: '64%', mem: '2.4Gi', status: 'HEALTHY' },
    { name: 'kafka-ingest-broker-0', pods: '3/3 Ready', cpu: '45%', mem: '1.8Gi', status: 'HEALTHY' },
    { name: 'postgres-primary-cluster', pods: '1/1 Ready', cpu: '38%', mem: '4.2Gi', status: 'HEALTHY' },
    { name: 'agent-orchestration-daemon', pods: '2/2 Ready', cpu: '19%', mem: '340Mi', status: 'HEALTHY' },
  ];

  return (
    <div className="flex-1 p-5 overflow-y-auto bg-slate-100 dark:bg-[#07090e] space-y-5 select-none transition-colors duration-200 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-600 dark:text-cyber-accent" />
          <h2 className="text-sm font-bold font-mono text-slate-900 dark:text-white uppercase tracking-wider">
            Infrastructure & Observability Command Plane
          </h2>
        </div>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          OpenTelemetry Collector: Active
        </span>
      </div>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="bg-white dark:bg-cyber-850 p-4 rounded-xl border border-slate-200 dark:border-cyber-700/70 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono">
            <span>Cluster CPU Usage</span>
            <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyber-accent" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {metrics.cpuUsagePercent.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-200 dark:bg-cyber-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-500 dark:bg-cyber-accent h-full transition-all duration-300"
              style={{ width: `${metrics.cpuUsagePercent}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div className="bg-white dark:bg-cyber-850 p-4 rounded-xl border border-slate-200 dark:border-cyber-700/70 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono">
            <span>Cluster Memory Usage</span>
            <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {metrics.memoryUsagePercent.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-200 dark:bg-cyber-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-500 h-full transition-all duration-300"
              style={{ width: `${metrics.memoryUsagePercent}%` }}
            />
          </div>
        </div>

        {/* API Latency */}
        <div className="bg-white dark:bg-cyber-850 p-4 rounded-xl border border-slate-200 dark:border-cyber-700/70 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono">
            <span>P99 API Latency</span>
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.apiLatencyMs.toFixed(1)} ms
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            SLO Target: &lt; 100ms (Passing)
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white dark:bg-cyber-850 p-4 rounded-xl border border-slate-200 dark:border-cyber-700/70 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono">
            <span>Global Error Rate</span>
            <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {(metrics.errorRatePercent * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            99.98% Healthy Requests
          </div>
        </div>
      </div>

      {/* Kubernetes Workload Status Table */}
      <div className="bg-white dark:bg-cyber-850 rounded-xl border border-slate-200 dark:border-cyber-700/70 p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-cyber-700/60">
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
            KUBERNETES PRODUCTION WORKLOADS
          </span>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            All Pods Healthy
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-cyber-800">
                <th className="pb-2">Service Name</th>
                <th className="pb-2">Pods</th>
                <th className="pb-2">CPU</th>
                <th className="pb-2">Memory</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-cyber-800/60 text-slate-700 dark:text-slate-300">
              {services.map((svc) => (
                <tr key={svc.name} className="hover:bg-slate-50 dark:hover:bg-cyber-800/40">
                  <td className="py-2.5 font-bold text-slate-900 dark:text-white">{svc.name}</td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400">{svc.pods}</td>
                  <td className="py-2.5">{svc.cpu}</td>
                  <td className="py-2.5">{svc.mem}</td>
                  <td className="py-2.5 text-right">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold">
                      {svc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
